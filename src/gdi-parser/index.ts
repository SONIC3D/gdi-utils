import {StringDecoder} from "string_decoder";
/**
 * index.ts
 * Created on 2017/七月/09
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */
import * as fs from 'fs';
import * as readline from 'readline';
import {isNumber} from "util";
import {strictEqual} from "assert";

export class GDITrack {
    protected m_LBA: number;
    protected m_typeId: number;     // 4 for Data and 0 for audio
    protected m_sectorSize: number;
    protected m_filename: string;
    protected m_unknown: number;

    constructor(lba: number, type: number, sectorSize: number, filename: string, unknown: number) {
        this.m_LBA = lba;
        this.m_typeId = type;
        this.m_sectorSize = sectorSize;
        this.m_filename = filename;
        this.m_unknown = unknown;
    }

    get Filename(): string {
        return this.m_filename;
    }

    get TypeId(): number {
        return this.m_typeId;
    }

    get sectorSize(): number {
        return this.m_sectorSize;
    }
}

export class GDILayout {
    protected m_trackCount: number;
    protected m_tracks: Map<number, GDITrack>;
    protected m_gdiFileLineParser: (lineContent: string) => void;

    protected constructor() {
        this.m_tracks = new Map<number, GDITrack>();
        this.m_gdiFileLineParser = (lineContent: string) => {
            this._gdiLineParser_TrackCountLine(lineContent);
        };
    }

    public static createFromFile(gdiFilePath: string): GDILayout {
        let retVal = new GDILayout();
        retVal.loadFromFile(gdiFilePath);
        return retVal;
    }

    public loadFromFile(gdiFilePath: string): void {
        let rstream = fs.createReadStream(gdiFilePath, {flags: 'r', autoClose: true});
        let rl = readline.createInterface({input: rstream});

        rl.on('close', () => {
            console.log(`Info: GDI file parsing finished.`);
            console.log(this.m_tracks);
        });

        rl.on('line', (input) => {
            // console.log(`Received: ${input}`);
            this.m_gdiFileLineParser(input);
        });
    }

    private _gdiLineParser_TrackCountLine(lineContent: string): void {
        console.log(`IndexLine: ${lineContent}`);
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
        console.log(`TrackLine: ${lineContent}`);
        let arrStr: Array<string> = lineContent.split(/\s+/);

        // // Debug log parsed results for this line
        // for (let i=0;i<arrStr.length;i++) {
        //     console.log(arrStr[i]);
        // }

        if (this._isValidTrackInfo(arrStr)) {
            let trackIdx:number = parseInt(arrStr[0]);
            if (this.m_tracks.has(trackIdx)) {
                console.log("Error: Duplicated track index in gdi file.");
            } else {
                let lba = parseInt(arrStr[1]);
                let type = parseInt(arrStr[2]);
                let sectorSize = parseInt(arrStr[3]);
                let trackFile = arrStr[4];
                let unknown = parseInt(arrStr[5]);
                this.m_tracks.set(trackIdx, new GDITrack(lba, type, sectorSize, trackFile, unknown));
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
}
