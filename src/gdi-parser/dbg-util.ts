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
    /**
     * A simple logger interface for external extending works.
     */
    export interface IGDILogger {
        error(message?: any, ...optionalParams: any[]): void;

        warn(message?: any, ...optionalParams: any[]): void;

        log(message?: any, ...optionalParams: any[]): void;

        info(message?: any, ...optionalParams: any[]): void;
    }

    /**
     * Default logger for gdi-utils library
     */
    export class StdGdiLogger implements IGDILogger {
        protected static s_instance: StdGdiLogger;

        public static getInstance(): StdGdiLogger {
            if (StdGdiLogger.s_instance == undefined) {
                StdGdiLogger.s_instance = new StdGdiLogger();
            }
            return StdGdiLogger.s_instance;
        }

        protected m_console: Console;

        protected constructor() {
            this.m_console = console;
        }

        public error(message?: any, ...optionalParams: any[]): void {
            this.m_console.error(message, ...optionalParams);
        }

        public warn(message?: any, ...optionalParams: any[]): void {
            this.m_console.warn(message, ...optionalParams);
        }

        public log(message?: any, ...optionalParams: any[]): void {
            this.m_console.log(message, ...optionalParams);
        }

        public info(message?: any, ...optionalParams: any[]): void {
            this.m_console.info(message, ...optionalParams);
        }
    }

    export class Debug {
        public static EnableOutputLog: boolean = false;
        public static EnableOutputError: boolean = true;

        // Initialize with the default gdi-util logger instance
        protected static s_logger: IGDILogger = StdGdiLogger.getInstance();

        /**
         * Set custom logger to output log with custom logic
         * @param {dbgUtil.IGDILogger} targetLogger
         */
        public static setLogger(targetLogger: IGDILogger): void {
            Debug.s_logger = targetLogger;
        }

        public static log(message?: any, ...optionalParams: any[]): void {
            if ((Debug.s_logger) && (Debug.EnableOutputLog)) {
                Debug.s_logger.log(message, ...optionalParams);
            }
        }

        public static error(message?: any, ...optionalParams: any[]): void {
            if ((Debug.s_logger) && (Debug.EnableOutputError)) {
                Debug.s_logger.error(message, ...optionalParams);
            }
        }
    }
}

export = dbgUtil;
