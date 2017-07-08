/**
 * MainEntry.ts
 * Created on 2017/七月/09
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */

export module MainEntry {
    export class MainEntry {
        constructor() {
            console.log("MainEntry created!");
        }

        public exec():void {
            // TODO: Program entry logic
            console.log("MainEntry::exec()");
        }
    }
}

// console.log("Program started!");
// let instance = new app.MainEntry();
// instance.exec();
// console.log("Program exit 1!");
