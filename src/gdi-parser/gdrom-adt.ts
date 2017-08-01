/**
 * gdrom-adt
 * Created on 2017/Aug/1
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */

/**
 * GD-ROM Abstract Data Type Module
 */
import { Buffer } from 'buffer';

module gdromadt {
    export enum EnumGdRomTrackType {
        Audio = 0,
        Data = 4
    }

    export enum EnumGdRomHDAreaPatternType {
        I,
        II,
        III,
        Invalid
    }

    export class GdRomDisc {
        public Lead_In_0: any;
        public SD_Program_Area: Map<number, GdRomTrack>;
        public Lead_Out_0: any;
        public Lead_In_1: any;
        public HD_Program_Area: Map<number, GdRomTrack>;
        public Lead_Out_1: any;

        get trackCountOfHDArea(): number {
            return this.HD_Program_Area.size;
        }

        /**
         * Get the TNO of last track in HD Area.
         * If there is no track in HD Area, return value would be 2.
         */
        get lastTrackNoOfHDArea(): number {
            let lastTrackNo = 2;
            for (let trackNo of this.HD_Program_Area.keys()) {
                if (trackNo > lastTrackNo) {
                    lastTrackNo = trackNo;
                }
            }
            return lastTrackNo;
        }

        get patternTypeOfHDArea(): EnumGdRomHDAreaPatternType {
            let retVal: EnumGdRomHDAreaPatternType = EnumGdRomHDAreaPatternType.Invalid;
            let lastTrackNo = this.lastTrackNoOfHDArea;

            if (lastTrackNo >= 3) {
                let trackObj = this.HD_Program_Area.get(lastTrackNo);
                switch (trackObj.Type) {
                    case EnumGdRomTrackType.Data:
                        if (lastTrackNo > 4) {
                            retVal = EnumGdRomHDAreaPatternType.III;
                        } else if (lastTrackNo == 3) {
                            retVal = EnumGdRomHDAreaPatternType.I;
                        }
                        break;
                    case EnumGdRomTrackType.Audio:
                        if (lastTrackNo > 3) {
                            retVal = EnumGdRomHDAreaPatternType.II;
                        }
                        break;
                }
            }
            return retVal;
        }

        constructor() {
            this.SD_Program_Area = new Map<number, GdRomTrack>();
            this.HD_Program_Area = new Map<number, GdRomTrack>();
        }

        public addTrackToSDArea(trackObj: GdRomTrack): number {
            trackObj.parent = this;
            let trackNo: number = this.SD_Program_Area.size + 1;
            trackObj.TrackNo = trackNo;
            this.SD_Program_Area.set(trackNo, trackObj);
            return trackNo;
        }

        public setTrackToSDArea(trackNo: number, trackObj: GdRomTrack): boolean {
            if ((trackNo < 0) || (trackNo > 2)) {
                return false;
            }
            trackObj.parent = this;
            trackObj.TrackNo = trackNo;
            this.SD_Program_Area.set(trackNo, trackObj);
            return true;
        }

        /**
         * Add track instance to the tail of current disc layout.
         * @param trackObj
         * @returns {number} Return the track number assigned to this trackObj, range from 3 to 99. Or return -1 if the current disc layout doesn't allow the target trackObj be added.
         */
        public addTrackToHDArea(trackObj: GdRomTrack): number {
            let retVal: number;
            if (this.patternTypeOfHDArea == EnumGdRomHDAreaPatternType.III) {
                // Cannot add any more track to a Pattern III HD Area.
                retVal = -1;
            } else if ((this.patternTypeOfHDArea == EnumGdRomHDAreaPatternType.I) && (trackObj.Type == EnumGdRomTrackType.Data)) {
                // Cannot add Data track to a Pattern I HD Area, only Audio track is allowed and thus the HD Area turns into Pattern II.
                retVal = -1;
            } else if ((this.HD_Program_Area.size == 0) && (trackObj.Type == EnumGdRomTrackType.Audio)) {
                // Audio track are not allowed to be added as track 3 (the 1st track in HD Area).
                retVal = -1;
            } else {
                // Other cases are all allowed.(Add Data track as track 3 or add Audio track after track 3 or add Data track after audio tracks)
                trackObj.parent = this;
                let trackNo: number = this.HD_Program_Area.size + 1 + 2;    // The 1st track in HD Area is track 3.
                trackObj.TrackNo = trackNo;
                this.HD_Program_Area.set(trackNo, trackObj);
                retVal = trackNo;
            }
            return retVal;
        }

        public setTrackToHDArea(trackNo: number, trackObj: GdRomTrack): boolean {
            let retVal: boolean;

            let lastTrackNo = this.lastTrackNoOfHDArea;

            if (trackNo - lastTrackNo == 1) {
                retVal = (this.addTrackToHDArea(trackObj) != -1);
            } else if (trackNo - lastTrackNo > 1) {
                // Inconsective track number is not allowed.
                retVal = false;
            } else if ((trackNo < 3) || (trackNo > 99)) {
                // Invalid track number range for HD Area.
                retVal = false;
            } else if ((trackNo == 3) && (trackObj.Type == EnumGdRomTrackType.Audio)) {
                // Track 3 can only be Data track.
                retVal = false;
            } else if ((trackNo == 4) && (trackObj.Type == EnumGdRomTrackType.Data)) {
                // Track 4 can only be Audio track.
                retVal = false;
            } else if ((trackNo > 4) && (trackObj.Type == EnumGdRomTrackType.Data) && (trackNo < lastTrackNo)) {
                // Data track can only be set to track 3 or the last Track.
                retVal = false;
            } else {
                trackObj.parent = this;
                trackObj.TrackNo = trackNo;
                this.HD_Program_Area.set(trackNo, trackObj);
                retVal = true;
            }
            return retVal;
        }
    }

    export class GdRomTrack {
        public parent: GdRomDisc;
        public TrackNo: number;
        public fad: number;                 // "Frame Address" used in Sega documents.
        public Type: EnumGdRomTrackType;
        public SectorSize: number;          // Byte length of each sector
        protected m_lengthInSector: number; // Total track length in sector of current track, include "Pause" and "PreGap" data mentioned in Sega documents.
        protected m_indices: Map<number, GdRomTrackIndex>;  // Index 00 and Index 01 of each track. No more index is allowed as it is shown in Sega documents.

        // "Logical Block Adress" used in .gdi file. LBA = FAD - 150.
        get lba(): number {
            return this.fad - 150;
        }

        set lba(value: number) {
            this.fad = value + 150;
        }

        get lengthInSector(): number {
            return this.m_lengthInSector;
        }

        set lengthInSector(value: number) {
            this.m_lengthInSector = value;
        }

        get lengthInByte(): number {
            return this.SectorSize * this.m_lengthInSector;
        }

        get indices(): Map<number, GdRomTrackIndex> {
            return this.m_indices;
        }

        get isLastTrackOfPattern3HDArea(): boolean {
            return ((this.Type == EnumGdRomTrackType.Data) && (this.TrackNo > 3));
        }

        get lengthOfIndex00InSector(): number {
            let retVal: number = 150;
            if (this.isLastTrackOfPattern3HDArea) {
                retVal = 225;
            }
            return retVal;
        }

        constructor() {
            this.m_indices = new Map<number, GdRomTrackIndex>();
            // this.m_indices.set(0, new GdRomTrackIndex());
            // this.m_indices.set(1, new GdRomTrackIndex());
            this.SectorSize = 2352;
        }

        public isFADInRange(fad: number): boolean {
            return ((fad >= this.fad) && (fad < this.fad + this.m_lengthInSector));
        }

        public readSectorRAW(fad: number): Buffer {
            let retBuf: Buffer;
            if (this.isFADInRange(fad)) {
                for (let i = 0; i < 2; i++) {
                    if (this.m_indices.has(i)) {
                        let currIndex = this.m_indices.get(i);
                        if (currIndex.isFADInRange(fad)) {
                            retBuf = currIndex.readSectorRAW(fad);
                            break;
                        }
                    }
                }
                // retBuf = Buffer.alloc(this.SectorSize);
            }
            return retBuf;
        }
    }

    export class GdRomTrackIndex {
        public parent: GdRomTrack;
        public fad: number;
        protected m_lengthInSector: number;
        public ContentParts: Array<GdRomTrackIndexPart>;

        get lengthInSector(): number {
            return this.m_lengthInSector;
        }

        set lengthInSector(value: number) {
            this.m_lengthInSector = value;
        }

        constructor() {
            this.ContentParts = [];
        }

        public isFADInRange(fad: number): boolean {
            return ((fad >= this.fad) && (fad < this.fad + this.m_lengthInSector));
        }

        public readSectorRAW(fad: number): Buffer {
            let retBuf: Buffer;
            if (this.isFADInRange(fad)) {
                let _foundProperPart: boolean = false;
                let _len = this.ContentParts.length;
                for (let i = 0; i < _len; i++) {
                    let _currPart = this.ContentParts[i];
                    if (_currPart.fad > fad) {
                        // Check if the start fad of current part is over head of the specific FAD. If so, use the previous part to test if the provided FAD is in its range.
                        let _prevIdx = i - 1;
                        let _prevPart = this.ContentParts[_prevIdx];
                        if (_prevPart.isFADInRange(fad)) {
                            retBuf = _prevPart.readSectorRAW(fad);
                            _foundProperPart = true;
                        }
                        break;
                    } else if (i == (_len - 1)) {
                        // For last part, immediately check if FAD is in its range.
                        if (_currPart.isFADInRange(fad)) {
                            retBuf = _currPart.readSectorRAW(fad);
                            _foundProperPart = true;
                        }
                    }
                }

                // If cannot find the sector data from exist data source(In memory byte array or a real file), produce a sector buffer with the provided track type and FAD value.
                if (!_foundProperPart) {
                    retBuf = this.producePseudoSetor(fad);
                }
            }
            return retBuf;
        }

        /**
         * Produce a pseudo sector buffer with the provided track type and FAD value.
         * @param fad
         * @returns {Buffer}
         */
        protected producePseudoSetor(fad: number): Buffer {
            let retBuf: Buffer;
            if (this.parent) {
                switch (this.parent.Type) {
                    case EnumGdRomTrackType.Data:
                        // TODO: Create a sector buffer with sync head and PQ channel
                        break;
                    case EnumGdRomTrackType.Audio:
                        retBuf = Buffer.alloc(this.parent.SectorSize, 0x00);
                        break;
                }
            }
            return retBuf;
        }
    }

    export class GdRomTrackIndexPart {
        public fad: number;
        protected m_lengthInSector: number;
        public PartType: number;    // 0: Part reference to a ByteArray.    1: Part reference to a file.
        public ContentByteArray: Buffer;
        public Filename: string;
        public Offset: number;
        public Length: number;

        public isFADInRange(fad: number): boolean {
            return ((fad >= this.fad) && (fad < this.fad + this.m_lengthInSector));
        }

        public readSectorRAW(fad: number): Buffer {
            let retBuf: Buffer;
            // TODO:
            return retBuf;
        }
    }
}
