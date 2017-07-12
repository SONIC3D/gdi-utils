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
import { Debug } from './dbg-util';
import { GDITrack } from './gdi-track';

module gdidisc {
    export class GDIDisc {
        protected static debugLog: (msg: string, ...param: any[]) => void = util.debuglog("GDIDisc");
        protected m_gdiFileDir: string;
        protected m_gdiFilename: string;
        protected m_trackCount: number;
        protected m_tracks: Map<number, GDITrack>;
        protected m_gdiFileLineParser: (lineContent: string) => void;
        protected m_parseCompleteCB: (gdiLayout: GDIDisc) => void;

        get trackCount(): number {
            return this.m_trackCount;
        }

        get tracks(): Map<number, GDITrack> {
            return this.m_tracks;
        }

        protected constructor() {
            this.m_trackCount = 0;
            this.m_tracks = new Map<number, GDITrack>();
            this.m_gdiFileLineParser = (lineContent: string) => {
                this._gdiLineParser_TrackCountLine(lineContent);
            };
        }

        public static createFromFile(gdiFilePath: string, parseCompleteCB?: (gdiLayout: GDIDisc) => void): GDIDisc {
            let retVal: GDIDisc;
            if (fs.existsSync(gdiFilePath)) {
                retVal = new GDIDisc();
                retVal.loadFromFile(gdiFilePath, (parseCompleteCB ? parseCompleteCB : undefined));
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
                GDIDisc.debugLog(`Info: GDI file parsing finished.`);
                // GDIDisc.debugLog(JSON.stringify([...this.m_tracks], null, 4));
                GDIDisc.debugLog(util.inspect(this, {depth: null}));
                if (this.m_parseCompleteCB) {
                    this.m_parseCompleteCB(this);
                }
            });

            rl.on('line', (input) => {
                // GDIDisc.debugLog(`Received: ${input}`);
                this.m_gdiFileLineParser(input);
            });
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
            let arrStr: Array<string> = lineContent.split(/\s+/);

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
                    let trackFile = arrStr[4];
                    let unknown = parseInt(arrStr[5]);
                    this.m_tracks.set(trackIdx, new GDITrack(this, this.m_gdiFileDir, trackIdx, lba, type, sectorSize, trackFile, unknown));
                }
            }
        }

        private _isValidTrackInfo(arrString: Array<string>): boolean {
            let retVal: boolean = ((arrString.length == 6)
            && (!isNaN(parseInt(arrString[0])) && (parseInt(arrString[0]) > 0))
            && (!isNaN(parseInt(arrString[1])) && (parseInt(arrString[1]) >= 0))
            && ((parseInt(arrString[2]) == 0) || (parseInt(arrString[2]) == 4))
            && (parseInt(arrString[3]) == 2352)
            && (!isNaN(parseInt(arrString[5]))));

            return retVal;
        }

        public printInfo(): void {
            if (this.trackCount > 0) {
                for (let [currTrkIdx, currTrack] of this.tracks) {
                    console.log(`========== Track ${currTrkIdx} Info ==========`);
                    if (currTrack) {
                        let _valid = currTrack.content.isValid;
                        console.log(`Valid:                             ${_valid ? "valid" : "invalid"}`);
                        if (_valid) {
                            console.log(`Size(Byte):                        ${currTrack.content.lengthInByte}`);
                            console.log(`Size(Sector):                      ${currTrack.content.lengthInSector}`);
                            console.log(`PreGap length:                     ${currTrack.preGapLengthInSector}`);
                            console.log(`Start LBA(PreGap):                 ${currTrack.startLBA_PreGap}`);
                            console.log(`Start LBA(Data):                   ${currTrack.startLBA_Data}`);
                            console.log(`End LBA:                           ${currTrack.endLBA}`);
                            console.log(`PreGap data embedded:              ${currTrack.isPreGapDataEmbedded}`);
                            console.log(`Overlapped with previous track:    ${currTrack.isOverlappedWithPreviousTrack}`);
                        }
                    } else {
                        console.log("<Empty track>");
                    }
                }
            }
        }
    }
}

export = gdidisc;
