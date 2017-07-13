/**
 * index.ts
 * Created on 2017/七月/09
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */
import { GDITrack, GDIDisc } from "./gdi-parser";

module app {
    export class MainEntry {
        constructor() {
            console.log("MainEntry created!");
        }

        public exec(): void {
            // TODO: Program entry logic
            console.log("MainEntry::exec()");
            //let gdiTrack = new GDITrack(123, 4, 2352, "track01.bin", 0);
            GDIDisc.createFromFile("test.gdi", (gdiLayout:GDIDisc) => {
                console.log("GDI file parsing finished.");

                gdiLayout.printInfo();
                gdiLayout.unload();
            });
        }
    }
}

console.log("Program started!");
let instance = new app.MainEntry();
instance.exec();
console.log("Program exit!");
