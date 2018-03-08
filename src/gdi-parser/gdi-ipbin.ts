/**
 * gdi-ipbin
 * Created on 2017/七月/14
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */
import {IGDILogger, StdGdiLogger} from "./dbg-util";

module gdiipbin {
    /**
     * InitialProgram is used to represent the content info of IP.BIN.
     */
    export class InitialProgram {
        protected m_logger: IGDILogger;
        protected m_contentBuf: Buffer;
        protected m_refTrackList: Array<RefTrackInfo>;

        public static createFromBuffer(dataBuf: Buffer, customLogger?: IGDILogger): InitialProgram {
            let retVal: InitialProgram = new InitialProgram();
            if (retVal) {
                retVal.initFromBuffer(dataBuf);
                if (customLogger != undefined) {
                    retVal.logger = customLogger;
                }
            }
            return retVal;
        }

        set logger(nv: IGDILogger) {
            this.m_logger = nv;
        }

        public constructor() {
            this.m_logger = StdGdiLogger.getInstance();
            this.m_contentBuf = Buffer.alloc(0x8000, 0x0);
            this.m_refTrackList = [];
        }

        public initFromBuffer(dataBuf: Buffer): void {
            if (dataBuf) {
                dataBuf.copy(this.m_contentBuf, 0, 0, 0x8000);
                this.initRefTrackList();
            }
        }

        public initRefTrackList(): void {
            let startOffset = 0x104;
            let cntTrackMax = 97;           // Reference track list contains only tracks in high density area.So it's max 99 tracks minus 2 tracks in low density area.
            let typeId_AudioTrack = 0x1;
            let typeId_DataTrack = 0x41;

            let cntValidTracks: number = 0;
            for (let i = 0; i < cntTrackMax; i++) {
                let startLBA = this.m_contentBuf.readUInt8(startOffset + i * 4);
                startLBA += 0x100 * this.m_contentBuf.readUInt8(startOffset + i * 4 + 1);
                startLBA += 0x10000 * this.m_contentBuf.readUInt8(startOffset + i * 4 + 2);
                let typeId = this.m_contentBuf.readUInt8(startOffset + i * 4 + 3);
                if ((typeId == typeId_AudioTrack) || (typeId == typeId_DataTrack)) {
                    // Valid Track
                    this.m_refTrackList.push(new RefTrackInfo(startLBA - 150, typeId));
                    cntValidTracks++;
                } else {
                    // Break for any invalid reference track record found(usually that's 0xFFFFFFFF)
                    break;
                }
            }
            // Calculate track sector length without PreGap
            for (let i = 0; i < cntValidTracks - 1; i++) {
                let currTrk = this.m_refTrackList[i];
                let nextTrk = this.m_refTrackList[i + 1];
                currTrk.lengthInSector = nextTrk.startLBA - currTrk.startLBA - 150;
            }
            this.m_refTrackList[cntValidTracks - 1].lengthInSector = 549150 - this.m_refTrackList[cntValidTracks - 1].startLBA;     // 549150 = 0x861B4 - 150, that's the end sector of GD-ROM(not inclusive).
        }

        public printInfo(): void {
            this.m_logger.log("IP.BIN content:");
            let lenLines: number = this.m_contentBuf.length / 16;
            for (let i = 0; i < lenLines; i++) {
                let start = i * 0x10;
                let end = start + 0x10;
                this.m_logger.log(`${this.m_contentBuf.toString('hex', start, end)}`);
            }

            let lenRefTrack = this.m_refTrackList.length;
            for (let i = 0; i < lenRefTrack; i++) {
                this.m_logger.log(`RefTrack ${i} startLBA: ${this.m_refTrackList[i].startLBA}`);
            }
        }
    }

    /**
     * RefTrackInfo is used to represent the reference track info in TOC area of IP.BIN.
     */
    class RefTrackInfo {
        protected m_startLBA: number;
        protected m_typeId: number;
        public lengthInSector: number;

        get startLBA(): number {
            return this.m_startLBA;
        }

        constructor(startLBA: number, typeId: number) {
            this.m_startLBA = startLBA;
            this.m_typeId = typeId;
        }

        get isAudioTrack(): boolean {
            return (this.m_typeId == 0x1);
        }

        get isDataTrack(): boolean {
            return (this.m_typeId == 0x41);
        }
    }
}

export = gdiipbin;
