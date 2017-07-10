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

class Debug {
    public static EnableOutputLog:boolean = false;
    public static EnableOutputError:boolean = true;

    public static log(message?: any, ...optionalParams: any[]): void {
        if (Debug.EnableOutputLog) {
            console.log(message, ...optionalParams);
        }
    }

    public static error(message?: any, ...optionalParams: any[]): void {
        if (Debug.EnableOutputError) {
            console.error(message, ...optionalParams);
        }
    }
}

export class GDITrack {
    protected m_LBA: number;
    protected m_typeId: number;     // 4 for Data and 0 for audio
    protected m_sectorSize: number;
    protected m_filename: string;
    protected m_unknown: number;

    protected m_content:GDITrackContent;
    get content():GDITrackContent {
        return this.m_content;
    }

    constructor(lba: number, type: number, sectorSize: number, filename: string, unknown: number) {
        this.m_LBA = lba;
        this.m_typeId = type;
        this.m_sectorSize = sectorSize;
        this.m_filename = filename;
        this.m_unknown = unknown;

        this.m_content = new GDITrackContent(this.m_filename, this.sectorSize);
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

export class GDITrackContent {
    protected m_filename: string;
    protected m_sectorSize: number;
    protected m_stats:fs.Stats;

    public constructor(filename: string, sectorSize: number) {
        this.m_filename = filename;
        this.m_sectorSize = (sectorSize > 0) ? sectorSize : 2352;
        this.refreshFileSystemStats();
    }

    protected refreshFileSystemStats():void {
        if (fs.existsSync(this.m_filename)) {
            this.m_stats = fs.statSync(this.m_filename);
        }
    }

    get isValid():boolean {
        let retVal:boolean = ((this.m_stats) && (this.m_stats.isFile()) && ((this.m_stats.size % this.m_sectorSize) == 0));
        return retVal;
    }

    get lengthInByte():number {
        return this.m_stats.size;
    }

    get lengthInSector():number {
        return this.lengthInByte / this.m_sectorSize;
    }
}

export class GDILayout {
    protected m_trackCount: number;
    protected m_tracks: Map<number, GDITrack>;
    protected m_gdiFileLineParser: (lineContent: string) => void;
    protected m_parseCompleteCB: () => void;

    get trackCount():number {
        return this.m_trackCount;
    }

    get tracks(): Map<number, GDITrack> {
        return this.m_tracks;
    }

    protected constructor() {
        this.m_tracks = new Map<number, GDITrack>();
        this.m_gdiFileLineParser = (lineContent: string) => {
            this._gdiLineParser_TrackCountLine(lineContent);
        };
    }

    public static createFromFile(gdiFilePath: string, parseCompleteCB?: () => void): GDILayout {
        let retVal = new GDILayout();
        retVal.loadFromFile(gdiFilePath, (parseCompleteCB ? parseCompleteCB : undefined));
        return retVal;
    }

    public loadFromFile(gdiFilePath: string, parseCompleteCB?: () => void): void {
        if (parseCompleteCB)
            this.m_parseCompleteCB = parseCompleteCB;
        let rstream = fs.createReadStream(gdiFilePath, {flags: 'r', autoClose: true});
        let rl = readline.createInterface({input: rstream});

        rl.on('close', () => {
            Debug.log(`Info: GDI file parsing finished.`);
            Debug.log(this.m_tracks);
            if (this.m_parseCompleteCB) {
                this.m_parseCompleteCB();
            }
        });

        rl.on('line', (input) => {
            // Debug.log(`Received: ${input}`);
            this.m_gdiFileLineParser(input);
        });
    }

    private _gdiLineParser_TrackCountLine(lineContent: string): void {
        Debug.log(`IndexLine: ${lineContent}`);
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
        Debug.log(`TrackLine: ${lineContent}`);
        let arrStr: Array<string> = lineContent.split(/\s+/);

        // // Debug log parsed results for this line
        // for (let i=0;i<arrStr.length;i++) {
        //     Debug.log(arrStr[i]);
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
