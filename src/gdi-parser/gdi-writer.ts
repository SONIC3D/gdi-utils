/**
 * gdi-writer
 * Created on 2017/七月/19
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { Buffer } from 'buffer';
import { Debug } from './dbg-util';
import { GDITrack } from './gdi-track';
import { GDIDisc } from './gdi-disc';

module gdiwriter {
    export interface IGDIWriter {
        exec(): void;
    }

    export class GeneralGDIWriter implements IGDIWriter {
        public static create(gdiDiscObj: GDIDisc, outputDir: string): GeneralGDIWriter {
            let retVal: GeneralGDIWriter = new GeneralGDIWriter();
            if (!retVal.init(gdiDiscObj, outputDir)) {
                retVal = undefined;
            }
            return retVal;
        }

        protected m_gdiDisc: GDIDisc;
        protected m_outputDir: string;

        public constructor() {
        }

        public init(gdiDiscObj: GDIDisc, outputDir: string): boolean {
            let retVal = true;      // TODO: validate if directory exists and gdiDiscObj is valid
            this.m_gdiDisc = gdiDiscObj;
            this.m_outputDir = outputDir;
            return retVal;
        }

        public exec(): void {
            this.writeGdiCueFile();
            this.writeGdiTrackFiles();
        }

        protected getOutputTrackFilename(trackId: number): string {
            let retVal: string = "track_error.bin";
            let _currTrk: GDITrack = this.m_gdiDisc.tracks.get(trackId);
            if (_currTrk) {
                let _typeId: number = _currTrk.typeId;
                retVal = `track${String('0' + trackId).slice(-2)}${(_typeId == 4) ? '.bin' : '.raw'}`;
            }
            return retVal;
        }

        protected writeGdiCueFile(): void {
            let _gdiFilePath = path.join(this.m_outputDir, "disc.gdi");
            let _gdiFileStream: fs.WriteStream = fs.createWriteStream(_gdiFilePath);

            if (_gdiFileStream) {
                _gdiFileStream.on('error', (err: any) => {
                    console.log("File write steam error:");
                    console.log(err);
                    _gdiFileStream.end();
                });

                let _cntTrks = this.m_gdiDisc.trackCount;
                // Write 1st line
                _gdiFileStream.write(`${_cntTrks}\n`);
                // Write track lines
                for (let i: number = 1; i <= _cntTrks; i++) {
                    let _currTrk: GDITrack = this.m_gdiDisc.tracks.get(i);
                    if (_currTrk) {
                        let _trkId = _currTrk.trackId;
                        let _startLBA = _currTrk.normalizedStartLBA_Data;
                        let _typeId = _currTrk.typeId;
                        let _sectorSize = _currTrk.sectorSize;
                        let _filename: string = this.getOutputTrackFilename(_trkId);
                        let _unknown = 0;
                        // Fix the case that the loaded disc is dumped in redump format and the last track is data track.
                        if (this.isTrackNeedLastDataTrackFix(i)) {
                            _startLBA = _startLBA + 75 + 150;
                        }
                        _gdiFileStream.write(`${_trkId} ${_startLBA} ${_typeId} ${_sectorSize} ${_filename} ${_unknown}\n`);
                    }
                }
                _gdiFileStream.end();
            }
        }

        protected isTrackNeedLastDataTrackFix(trackId: number): boolean {
            let retVal: boolean = false;
            let _cntTracks = this.m_gdiDisc.trackCount;
            if (_cntTracks > 3) {
                let _currTrk: GDITrack = this.m_gdiDisc.tracks.get(trackId);
                let _prevTrk: GDITrack = this.m_gdiDisc.tracks.get(trackId - 1);
                if ((trackId == _cntTracks) && (_currTrk.isDataTrack) && (_prevTrk.isAudioTrack) && (this.m_gdiDisc.isRedumpFormatDetected)) {
                    retVal = true;
                }
            }
            return retVal;
        }

        protected writeGdiTrackFiles(): void {
            // Write tracks in low density area
            for (let i = 1; i <= 2; i++) {
                let _currTrack = this.m_gdiDisc.tracks.get(i);
                if (_currTrack.content.isValid) {
                    let _srcTrackLBAStart = _currTrack.discLBAtoTrackLBA(_currTrack.normalizedStartLBA_Data);
                    let _srcTrackLBAEnd = _currTrack.discLBAtoTrackLBA(_currTrack.endLBA);
                    let _srcTrackFileOffset = _currTrack.discLBAtoFileByteOffset(_currTrack.normalizedStartLBA_Data);
                    let _srcTrackContentByteLength = _currTrack.sectorSize * (_srcTrackLBAEnd - _srcTrackLBAStart);

                    // Open file for write
                    let _outTrackFilePath = path.join(this.m_outputDir, this.getOutputTrackFilename(i));
                    let _outTrackFile_FD = fs.openSync(_outTrackFilePath, 'w');

                    this._copyTrackContent(_currTrack, _srcTrackFileOffset, _srcTrackContentByteLength, _outTrackFile_FD, 0);

                    // Close file and this is the end of this track
                    fs.closeSync(_outTrackFile_FD);
                } else {
                    console.log(`Invalid source track found when trying to write output track, track ${i} is skipped...`);
                }
                console.log(`Track ${i} is finished copying.`);
            }
            console.log(`Low density area is finished copying.`);

            // Write tracks in high density area
            // TODO: Write tracks in high density area
        }

        /**
         * Write content of source file to the specific offset position of the output file which is specified by a file description.
         * @param srcTrack
         * @param srcTrackFileOffset
         * @param srcTrackContentByteLength
         * @param outFileFD
         * @param outTrackFileWriteStartOffset Write offset in output file, usually it's zero for newly created track file. But if the output file is filled by multiple source file content, then this would be meaningful.
         * @returns {number} The actual bytes written in total in this routing.
         * @private
         */
        private _copyTrackContent(srcTrack: GDITrack, srcTrackFileOffset: number, srcTrackContentByteLength: number, outFileFD: number, outTrackFileWriteStartOffset: number): number {
            let DEFAULT_COPYING_BUFFER_LENGTH = srcTrack.sectorSize * 10240;  // 20MB file copying buffer as default

            let _readOffsetCurrLoop = srcTrackFileOffset;
            let _writeOffsetCurrLoop = outTrackFileWriteStartOffset;
            let _totalByteLenLeft = srcTrackContentByteLength;
            let _cpBufLenCurrLoop = DEFAULT_COPYING_BUFFER_LENGTH;
            let _cpBuf: Buffer = Buffer.alloc(_cpBufLenCurrLoop);   // Reallocate buffer for first copying buffer chunk.
            let _totalBytesWritten: number = 0;
            while (_totalByteLenLeft > 0) {
                if (_cpBufLenCurrLoop != _totalByteLenLeft) {
                    // Reallocate buffer for last copying buffer chunk(a smaller buffer chunk).
                    _cpBuf = Buffer.alloc(_totalByteLenLeft);
                    _cpBufLenCurrLoop = _totalByteLenLeft;
                }
                // Data read
                srcTrack.content.readByteData(_cpBuf, 0, _readOffsetCurrLoop, _cpBufLenCurrLoop);
                // Data write
                if (outFileFD) {
                    let bytesActuallyWritten: number = fs.writeSync(outFileFD, _cpBuf, 0, _cpBufLenCurrLoop, _writeOffsetCurrLoop);
                    if (bytesActuallyWritten != _cpBufLenCurrLoop) {
                        console.log(`Track write wrong on track ${srcTrack.trackId}`);
                        break;  // break out of the buffer copying loop, directly go to close file procedure
                    }
                }
                // Prepare for reading next chunk of data from source track file
                _readOffsetCurrLoop += _cpBufLenCurrLoop;
                _writeOffsetCurrLoop += _cpBufLenCurrLoop;
                _totalByteLenLeft = srcTrackContentByteLength - _readOffsetCurrLoop;
                _totalBytesWritten += _cpBufLenCurrLoop;
            }

            return _totalBytesWritten;
        }
    }
}

export = gdiwriter;
