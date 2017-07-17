/**
 * gdi-track
 * Created on 2017/七月/13
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { Debug } from './dbg-util';
import { GDIDisc } from './gdi-disc';

module gditrack {
    export class GDITrack {
        protected static debugLog: (msg: string, ...param: any[]) => void = util.debuglog("GDITrack");

        protected m_parentGdi: GDIDisc;
        protected m_fileDir: string;
        protected m_idxInParentGdi: number;

        protected m_LBA: number;
        protected m_typeId: number;     // 4 for Data and 0 for audio
        protected m_sectorSize: number;
        protected m_filename: string;
        protected m_unknown: number;

        protected m_content: GDITrackContent;

        get content(): GDITrackContent {
            return this.m_content;
        }

        constructor(parentGdi: GDIDisc, trackFileDir: string, indexInParentGdi: number, lba: number, type: number, sectorSize: number, filename: string, unknown: number) {
            this.m_parentGdi = parentGdi;
            this.m_fileDir = trackFileDir;
            this.m_idxInParentGdi = indexInParentGdi;

            this.m_LBA = lba;
            this.m_typeId = type;
            this.m_sectorSize = sectorSize;
            this.m_filename = filename;
            this.m_unknown = unknown;

            this.m_content = new GDITrackContent(this, this.m_fileDir, this.m_filename, this.sectorSize);
        }

        get trackId(): number {
            return this.m_idxInParentGdi;
        }

        get filename(): string {
            return this.m_filename;
        }

        /**
         * Type id of the current track. 0 for Audio track and 4 for data track.
         * @returns {number}
         */
        get typeId(): number {
            return this.m_typeId;
        }

        get sectorSize(): number {
            return this.m_sectorSize;
        }

        get isAudioTrack(): boolean {
            return (this.typeId == 0);
        }

        /**
         * Audio track should have a pre gap of 150 sectors
         */
        get preGapLengthInSector(): number {
            return (this.isAudioTrack ? 150 : 0);
        }

        get startLBA_PreGap(): number {
            return this.m_LBA - this.preGapLengthInSector;
        }

        get startLBA_Data(): number {
            return this.m_LBA;
        }

        /**
         * LBA that current track ends on.(It not the 'last' sector of current track, but the start LBA of the next track with PreGap data)
         * @returns {number}
         */
        get endLBA(): number {
            return this.startLBA_Data + this.m_content.lengthInSector;
        }

        /**
         * For redump format GDI audio track, there is 150 sectors embedded pre gap data in the current track file head part.
         * There is no such embedded data in TruRip or Tosec GDI image.
         */
        get isPreGapDataEmbedded(): boolean {
            let retVal = false;
            if (this.isAudioTrack) {
                // Reading 16 byte from the track head. If it's filled with 0x00, then that's the embedded pre gap data.
                retVal = true;
                let buffer: Buffer = Buffer.alloc(16);
                if (this.content.readByteData(buffer, 0, 0, 16) == 16) {
                    GDITrack.debugLog(buffer.toString('hex'));
                    for (let i = 0; i < buffer.byteLength; i++) {
                        let currByte = buffer.readUInt8(i);
                        if (currByte != 0) {
                            retVal = false;
                            break;
                        }
                    }
                } else {
                    Debug.error("GDITrack.isPreGapDataEmbedded Error: Failed to read data from track!");
                }
            }
            return retVal;
        }

        /**
         * For redump format GDI, if audio track are dealed as TruRip or Tosec GDI format, the first audio track following a data track would be overlapped with previous data track in pre gap region.
         * @returns {boolean}
         */
        get isOverlappedWithPreviousTrack(): boolean {
            let retVal = false;
            if ((this.trackId != 1) && (this.trackId != 3)) {
                let preTrack = this.m_parentGdi.tracks.get(this.trackId - 1);
                if ((preTrack) && (preTrack.endLBA > this.startLBA_PreGap)) {
                    retVal = true;
                }
            }
            return retVal;
        }

        public readSectorRAW(startLBA: number, lenOfSectorsToRead: number = 1, maxReadBufferSize: number = this.sectorSize * 1024): Buffer {
            let retVal: Buffer;
            let normalizedStartLBA = startLBA;
            // Add 150 sectors for redump format audio track data
            if (this.isPreGapDataEmbedded) {
                normalizedStartLBA += 150;
            }
            let readLen = this.sectorSize;
            let buf: Buffer = Buffer.alloc(readLen);
            if (this.content.readByteData(buf, 0, normalizedStartLBA * this.sectorSize, readLen) == readLen) {
                retVal = buf;
            }
            return retVal;
        }
    }

    export class GDITrackContent {
        protected static debugLog: (msg: string, ...param: any[]) => void = util.debuglog("GDITrackContent");

        protected m_track: GDITrack;
        protected m_fileDir: string;
        protected m_filename: string;
        protected m_sectorSize: number;
        protected m_stats: fs.Stats;
        protected m_fd: number;         // File descriptor for the opened track file

        public constructor(trackObj: GDITrack, fileDir: string, filename: string, sectorSize: number) {
            this.m_track = trackObj;
            this.m_fileDir = fileDir;
            this.m_filename = filename;
            this.m_sectorSize = (sectorSize > 0) ? sectorSize : 2352;
            this.refreshFileSystemStats();
            this.openTrackFile();
        }

        protected refreshFileSystemStats(): void {
            let _filePath: string = path.join(this.m_fileDir, this.m_filename);
            GDITrackContent.debugLog(`Track file path: ${_filePath}.`);
            if (fs.existsSync(_filePath)) {
                this.m_stats = fs.statSync(_filePath);
            }
        }

        protected openTrackFile(): void {
            let _filePath: string = path.join(this.m_fileDir, this.m_filename);
            if (fs.existsSync(_filePath)) {
                try {
                    this.m_fd = fs.openSync(_filePath, 'r');
                } catch (e) {
                    Debug.error('openTrackFile Error:', e);
                }
            }
        }

        protected closeTrackFile(): void {
            if (this.m_fd) {
                try {
                    fs.closeSync(this.m_fd);
                } catch (e) {
                    Debug.error('closeTrackFile Error:', e);
                }
            }
        }

        /**
         * Validate if the track content file exists and the size is valid in logical
         * @returns {boolean}
         */
        get isValid(): boolean {
            let retVal: boolean = ((this.m_stats) && (this.m_stats.isFile()) && ((this.m_stats.size % this.m_sectorSize) == 0));
            return retVal;
        }

        get lengthInByte(): number {
            return this.m_stats.size;
        }

        get lengthInSector(): number {
            return this.lengthInByte / this.m_sectorSize;
        }

        /**
         * Unload opened files and allocated resource for current track
         */
        public unload(): void {
            GDITrackContent.debugLog(`Unloading Track ${this.m_track.trackId} content ...`);
            this.closeTrackFile();
        }

        /**
         * Read specific length of data in byte into target buffer from the offset relative to the start of the track file
         * @param targetBuffer
         * @param targetStart
         * @param trackFileOffset
         * @param readLength
         * @returns {number} The actual length of the data that read
         */
        public readByteData(targetBuffer: Buffer, targetStart:number, trackFileOffset: number, readLength: number): number {
            let retVal: number = 0;
            if (this.m_fd) {
                retVal = fs.readSync(this.m_fd, targetBuffer, targetStart, readLength, trackFileOffset);
            }
            return retVal;
        }
    }
}

export = gditrack;
