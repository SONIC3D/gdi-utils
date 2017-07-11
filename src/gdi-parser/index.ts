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
import * as path from 'path';
import * as readline from 'readline';
import * as util from 'util';

class Debug {
    public static EnableOutputLog: boolean = false;
    public static EnableOutputError: boolean = true;

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
    protected static debugLog:(msg: string, ...param: any[]) => void = util.debuglog("GDITrack");
    protected m_fileDir: string;
    protected m_LBA: number;
    protected m_typeId: number;     // 4 for Data and 0 for audio
    protected m_sectorSize: number;
    protected m_filename: string;
    protected m_unknown: number;

    protected m_content:GDITrackContent;
    get content():GDITrackContent {
        return this.m_content;
    }

    constructor(trackFileDir:string,lba: number, type: number, sectorSize: number, filename: string, unknown: number) {
        this.m_fileDir = trackFileDir;
        this.m_LBA = lba;
        this.m_typeId = type;
        this.m_sectorSize = sectorSize;
        this.m_filename = filename;
        this.m_unknown = unknown;

        this.m_content = new GDITrackContent(this.m_fileDir, this.m_filename, this.sectorSize);
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
    protected static debugLog:(msg: string, ...param: any[]) => void = util.debuglog("GDITrackContent");
    protected m_fileDir: string;
    protected m_filename: string;
    protected m_sectorSize: number;
    protected m_stats:fs.Stats;

    public constructor(fileDir: string, filename: string, sectorSize: number) {
        this.m_fileDir = fileDir;
        this.m_filename = filename;
        this.m_sectorSize = (sectorSize > 0) ? sectorSize : 2352;
        this.refreshFileSystemStats();
    }

    protected refreshFileSystemStats():void {
        let _filePath:string = path.join(this.m_fileDir, this.m_filename);
        GDITrackContent.debugLog(`Track file path: ${_filePath}.`);
        if (fs.existsSync(_filePath)) {
            this.m_stats = fs.statSync(_filePath);
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
    protected static debugLog:(msg: string, ...param: any[]) => void = util.debuglog("GDILayout");
    protected m_gdiFileDir: string;
    protected m_gdiFilename: string;
    protected m_trackCount: number;
    protected m_tracks: Map<number, GDITrack>;
    protected m_gdiFileLineParser: (lineContent: string) => void;
    protected m_parseCompleteCB: () => void;

    get trackCount(): number {
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
        let retVal: GDILayout;
        if (fs.existsSync(gdiFilePath)) {
            retVal = new GDILayout();
            retVal.loadFromFile(gdiFilePath, (parseCompleteCB ? parseCompleteCB : undefined));
        }
        return retVal;
    }

    public loadFromFile(gdiFilePath: string, parseCompleteCB?: () => void): void {
        if (parseCompleteCB)
            this.m_parseCompleteCB = parseCompleteCB;
        this.m_gdiFileDir = path.dirname(gdiFilePath);
        this.m_gdiFilename = path.basename(gdiFilePath);
        GDILayout.debugLog(this.m_gdiFileDir);
        GDILayout.debugLog(this.m_gdiFilename);

        let rstream = fs.createReadStream(gdiFilePath, {flags: 'r', autoClose: true});
        let rl = readline.createInterface({input: rstream});

        rl.on('close', () => {
            GDILayout.debugLog(`Info: GDI file parsing finished.`);
            GDILayout.debugLog(JSON.stringify([...this.m_tracks], null, 4));
            if (this.m_parseCompleteCB) {
                this.m_parseCompleteCB();
            }
        });

        rl.on('line', (input) => {
            // GDILayout.debugLog(`Received: ${input}`);
            this.m_gdiFileLineParser(input);
        });
    }

    private _gdiLineParser_TrackCountLine(lineContent: string): void {
        GDILayout.debugLog(`IndexLine: ${lineContent}`);
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
        GDILayout.debugLog(`TrackLine: ${lineContent}`);
        let arrStr: Array<string> = lineContent.split(/\s+/);

        // // Debug log parsed results for this line
        // for (let i=0;i<arrStr.length;i++) {
        //     GDILayout.debugLog(arrStr[i]);
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
                this.m_tracks.set(trackIdx, new GDITrack(this.m_gdiFileDir, lba, type, sectorSize, trackFile, unknown));
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