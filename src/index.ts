/**
 * index.ts
 * Created on 2017/七月/09
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */

/// <reference path="./MainEntry.ts" />

// import * as app from "./MainEntry";
import { MainEntry } from "./MainEntry";

console.log("Program started!");
let instance = new MainEntry.MainEntry();
instance.exec();
console.log("Program exit!");
