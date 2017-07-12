/**
 * dbg-util
 * Created on 2017/七月/13
 *
 * Author:
 *      "SONIC3D <sonic3d@gmail.com>"
 *
 * Copyright (c) 2017 "SONIC3D <sonic3d@gmail.com>"
 */

module dbgUtil {
    export class Debug {
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
}

export = dbgUtil;
