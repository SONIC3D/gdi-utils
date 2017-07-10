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
        protected m_gdiObj: GDILayout;

        constructor() {
            console.log("MainEntry created!");
        }

        public exec(): void {
            // TODO: Program entry logic
            console.log("MainEntry::exec()");
            //let gdiTrack = new GDITrack(123, 4, 2352, "track01.bin", 0);
            this.m_gdiObj = GDILayout.createFromFile("test.gdi", () => {
                console.log("GDI file parsing finished.");

                for (let i = 1; i <= this.m_gdiObj.trackCount; i++) {
                    let currTrack = this.m_gdiObj.tracks.get(i);
                    if (currTrack) {
                        let _valid = currTrack.content.isValid
                        console.log(`Track ${i} is ${_valid ? "valid" : "invalid"}`);
                        if (_valid) {
                            console.log(`Size in byte: ${currTrack.content.lengthInByte}`);
                            console.log(`Size in sector: ${currTrack.content.lengthInSector}`);
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
