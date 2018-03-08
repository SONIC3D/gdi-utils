/**
 * index.ts
 * Created on 2017/七月/09
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */
import * as dbgutil from './dbg-util';
import * as gdidisc from './gdi-disc';
import * as gditrack from './gdi-track';
import * as gdiwriter from "./gdi-writer";

export class Debug extends dbgutil.Debug {
}

export interface IGDILogger extends dbgutil.IGDILogger {
}

export class GDIDisc extends gdidisc.GDIDisc {
}

export class GDITrack extends gditrack.GDITrack {
}

export class GeneralGDIWriter extends gdiwriter.GeneralGDIWriter {

}
