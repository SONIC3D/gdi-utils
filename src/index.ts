/**
 * index.ts
 * Created on 2017/七月/09
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */
import { GDITrack, GDILayout } from "./gdi-parser";

module app {
    export class MainEntry {
        constructor() {
            console.log("MainEntry created!");
        }

        public exec(): void {
            // TODO: Program entry logic
            console.log("MainEntry::exec()");
            //let gdiTrack = new GDITrack(123, 4, 2352, "track01.bin", 0);
            GDILayout.createFromFile("test.gdi", () => {
                console.log("GDI file parsing finished.");

                for (let i = 1; i <= gdiLayout.trackCount; i++) {
                    console.log(`==========`);
                    let currTrack = gdiLayout.tracks.get(i);
                    if (currTrack) {
                        let _valid = currTrack.content.isValid
                        console.log(`Track ${i} is ${_valid ? "valid" : "invalid"}`);
                        if (_valid) {
                            console.log(`Size in byte: ${currTrack.content.lengthInByte}`);
                            console.log(`Size in sector: ${currTrack.content.lengthInSector}`);
                            console.log(`Track PreGap length: ${currTrack.preGapLengthInSector}`);
                            console.log(`Track start LBA of PreGap: ${currTrack.startLBA_PreGap}`);
                            console.log(`Track start LBA of Data: ${currTrack.startLBA_Data}`);
                            console.log(`Track end LBA: ${currTrack.endLBA}`);
                            console.log(`Track is PreGap data embedded: ${currTrack.isPreGapDataEmbedded}`);
                            console.log(`Track is overlapped with previous track: ${currTrack.isOverlappedWithPreviousTrack}`);
                        }
                    }
                }
            });
        }
    }
}

console.log("Program started!");
let instance = new app.MainEntry();
instance.exec();
console.log("Program exit!");
