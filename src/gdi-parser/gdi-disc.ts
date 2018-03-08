/**
 * gdi-disc
 * Created on 2017/七月/13
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as util from 'util';
import {Buffer} from 'buffer';
import {Debug, IGDILogger, StdGdiLogger} from './dbg-util';
import {GDITrack} from './gdi-track';
import {InitialProgram} from './gdi-ipbin';

module gdidisc {
    export class GDIDisc {
        protected static debugLog: (msg: string, ...param: any[]) => void = util.debuglog("GDIDisc");
        protected m_logger: IGDILogger;
        protected m_gdiFileDir: string;
        protected m_gdiFilename: string;
        protected m_trackCount: number;
        protected m_tracks: Map<number, GDITrack>;
        protected m_gdiFileLineParser: (lineContent: string) => void;
        protected m_parseCompleteCB: (gdiLayout: GDIDisc) => void;

        // IP.BIN data read from track 03 sector 0-16. There are 2048(0x800) bytes per sector, so it's 0x8000 in all.
        protected m_ipBin: InitialProgram;
        protected m_isIpBinLoaded: boolean;

        set logger(nv: IGDILogger) {
            this.m_logger = nv;
        }

        get trackCount(): number {
            return this.m_trackCount;
        }

        get tracks(): Map<number, GDITrack> {
            return this.m_tracks;
        }

        get isRedumpFormatDetected(): boolean {
            let retVal: boolean = false;
            let _cntTrks = this.trackCount;
            for (let i: number = 1; i <= _cntTrks; i++) {
                let _currTrk: GDITrack = this.tracks.get(i);
                if (_currTrk.isPreGapDataEmbedded) {
                    retVal = true;
                    break;
                }
            }
            return retVal;
        }

        get ipBin(): InitialProgram {
            return this.m_ipBin;
        }

        get isIpBinLoaded(): boolean {
            return this.m_isIpBinLoaded;
        }

        /**
         * Identify if this is a logical valid gdi image and all track files are able to load.
         * @returns {boolean}
         */
        get isValid(): boolean {
            let retVal = this.isIpBinLoaded;
            if (retVal) {
                let _cntTrks = this.trackCount;
                for (let i: number = 1; i <= _cntTrks; i++) {
                    let _currTrk: GDITrack = this.tracks.get(i);
                    if ((_currTrk) && (!_currTrk.content.isValid)) {
                        retVal = false;
                        break;
                    }
                }
            }
            return retVal;
        }

        protected constructor() {
            this.m_logger = StdGdiLogger.getInstance();
            this.m_trackCount = 0;
            this.m_tracks = new Map<number, GDITrack>();
            this.m_gdiFileLineParser = (lineContent: string) => {
                this._gdiLineParser_TrackCountLine(lineContent);
            };
            this.m_isIpBinLoaded = false;
        }

        public static createFromFile(gdiFilePath: string, parseCompleteCB?: (gdiLayout: GDIDisc) => void, customLogger?: IGDILogger): GDIDisc {
            let retVal: GDIDisc;
            if (fs.existsSync(gdiFilePath)) {
                retVal = new GDIDisc();
                retVal.loadFromFile(gdiFilePath, (parseCompleteCB ? parseCompleteCB : undefined));
                if (customLogger != undefined) {
                    retVal.logger = customLogger;
                }
            }
            return retVal;
        }

        public loadFromFile(gdiFilePath: string, parseCompleteCB?: (gdiLayout: GDIDisc) => void): void {
            if (parseCompleteCB)
                this.m_parseCompleteCB = parseCompleteCB;
            this.m_gdiFileDir = path.dirname(gdiFilePath);
            this.m_gdiFilename = path.basename(gdiFilePath);
            GDIDisc.debugLog(this.m_gdiFileDir);
            GDIDisc.debugLog(this.m_gdiFilename);

            let rstream = fs.createReadStream(gdiFilePath, {flags: 'r', autoClose: true});
            let rl = readline.createInterface({input: rstream});

            rl.on('close', () => {
                this.onGdiFileParseComplete();
            });

            rl.on('line', (input) => {
                // GDIDisc.debugLog(`Received: ${input}`);
                this.m_gdiFileLineParser(input);
            });
        }

        protected onGdiFileParseComplete(): void {
            // load ip.bin data from Track 03 for accurate track data
            this.m_isIpBinLoaded = this.initIpBin();

            GDIDisc.debugLog(`Info: GDI file parsing finished.`);
            // GDIDisc.debugLog(JSON.stringify([...this.m_tracks], null, 4));
            GDIDisc.debugLog(util.inspect(this, {depth: null}));

            // inform upper logic level that gdi has been fully parsed and loaded.
            if (this.m_parseCompleteCB) {
                this.m_parseCompleteCB(this);
            }
        }

        protected initIpBin(): boolean {
            let retVal: boolean = false;
            let _ipbinDataBuf: Buffer = Buffer.alloc(0x8000, 0x00);
            if (this.tracks.has(3)) {
                let track3 = this.tracks.get(3);
                if (track3.content.isValid) {
                    // loop 16 sectors in all
                    for (let i = 0; i < 0x10; i++) {
                        // Skip 16 byte sync data and read 2048 user data from raw sector.
                        track3.content.readByteData(_ipbinDataBuf, i * 0x800, i * track3.sectorSize + 0x10, 0x800);
                    }
                    this.m_ipBin = InitialProgram.createFromBuffer(_ipbinDataBuf, this.m_logger);
                    retVal = true;
                }
            }
            return retVal;
        }

        public unload(): void {
            if (this.trackCount > 0) {
                for (let [idx, track] of this.tracks) {
                    if (track) {
                        track.content.unload();
                    }
                }
            }
        }

        private _gdiLineParser_TrackCountLine(lineContent: string): void {
            GDIDisc.debugLog(`IndexLine: ${lineContent}`);
            let result = parseInt(lineContent);

            // Alter to line parser callback
            if (!isNaN(result)) {
                this.m_trackCount = result;
                this.m_gdiFileLineParser = (lineContent: string) => {
                    this._gdiLineParser_TrackContentLine(lineContent);
                };
            }
        }

        private _gdiLineParser_TrackContentLine(lineContent: string): void {
            GDIDisc.debugLog(`TrackLine: ${lineContent}`);
            let trackFilename = "";
            // Redump gdi track file with white space in long filename would be quoted.
            let arrQuoteDelimStr: Array<string> = lineContent.split("\"");
            if (arrQuoteDelimStr.length > 1)
                trackFilename = arrQuoteDelimStr[1];

            // Redump gdi image with more than 10 tracks would add white space ahead of the line of track 1-9 to create indent.
            // That causes the first delimited item becomes an empty string.
            let arrStr: Array<string> = lineContent.split(/\s+/);
            if ((arrStr.length > 1) && (arrStr[0].length == 0))
                arrStr = arrStr.slice(1);

            // // Debug log parsed results for this line
            // for (let i=0;i<arrStr.length;i++) {
            //     GDIDisc.debugLog(arrStr[i]);
            // }

            if (this._isValidTrackInfo(arrStr)) {
                let trackIdx: number = parseInt(arrStr[0]);
                if (this.m_tracks.has(trackIdx)) {
                    Debug.error("Error: Duplicated track index in gdi file.");
                } else {
                    let lba = parseInt(arrStr[1]);
                    let type = parseInt(arrStr[2]);
                    let sectorSize = parseInt(arrStr[3]);
                    if (trackFilename.length == 0)
                        trackFilename = arrStr[4];
                    let unknown = parseInt(arrStr[arrStr.length - 1]);
                    this.m_tracks.set(trackIdx, new GDITrack(this, this.m_gdiFileDir, trackIdx, lba, type, sectorSize, trackFilename, unknown, this.m_logger));
                }
            }
        }

        private _isValidTrackInfo(arrString: Array<string>): boolean {
            let retVal: boolean = ((arrString.length >= 6)
                && (!isNaN(parseInt(arrString[0])) && (parseInt(arrString[0]) > 0))
                && (!isNaN(parseInt(arrString[1])) && (parseInt(arrString[1]) >= 0))
                && ((parseInt(arrString[2]) == 0) || (parseInt(arrString[2]) == 4))
                && (parseInt(arrString[3]) == 2352)
                && (!isNaN(parseInt(arrString[arrString.length - 1]))));

            return retVal;
        }

        /**
         * Return the GDITrack object which contains the target sector data.
         * Note: There is special case in games with audiio tracks and last track is data track type.
         *       Redump dumps of these games moves first 75 sectors of the last data track to the tail of its previous track.
         *       In this case, if discLBA in this 75 sectors range is provided, this method will return the previous track as the purpose of this method is to locate which track file the actual sector data is stored from the loaded gdi image.
         * @param discLBA
         * @returns {GDITrack}
         */
        public getSectorOwnerTrack(discLBA: number): GDITrack {
            let retVal: GDITrack;
            // Enumerate tracks in order of track id. Orders do matter in this function!
            for (let i: number = 1; i <= this.trackCount; i++) {
                let currTrack = this.tracks.get(i);
                if (discLBA < currTrack.normalizedStartLBA_Data) {
                    // The specified discLBA is stay before current track and after the last track.
                    // Maybe it's in pre gap area of current track.
                    // Anyway, just return undefined value in this case and skip further compare for tracks after current track.
                    break;
                } else if (discLBA < currTrack.endLBA) {
                    retVal = currTrack;
                    break;
                }
            }
            return retVal;
        }

        public readSectorRAW(startLBA: number): Buffer {
            // TODO: Read sector data by using LBA relative to the whole GD-ROM
            return Buffer.alloc(16);
        }

        public printInfo(): void {
            if (this.trackCount > 0) {
                for (let [currTrkIdx, currTrack] of this.tracks) {
                    this.m_logger.log(`========== Track ${currTrkIdx} Info ==========`);
                    if (currTrack) {
                        currTrack.printInfo();
                    } else {
                        this.m_logger.log("[Empty track]");
                    }
                }
                this.m_logger.log(`========== End of Track Info ==========`);
            }
        }

        public printIpBinInfo(): void {
            if (this.m_ipBin)
                this.m_ipBin.printInfo();
        }
    }
}

export = gdidisc;
