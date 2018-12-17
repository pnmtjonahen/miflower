/*
 * Logging, uses a {timestamp} {loggername} {level} - {message} formatter
 *  
 */

const DEBUG = 0b0001;
const INFO = 0b0010;
const WARN = 0b0100;
const ERROR = 0b1000;

class Logger {
    constructor(logger, level) {
        this.logger = logger;
        this.level = level;
    }
    
    debug(message) {
        if ((this.level & DEBUG) === DEBUG)
            console.log("%s %s DEBUG - %s", new Date().toISOString(), this.logger, message);
    }
    info(message) {
        if ((this.level & INFO) === INFO)
            console.log("%s %s INFO - %s", new Date().toISOString(), this.logger, message);
    }
    warn(message) {
        if ((this.level & WARN) === WARN)
            console.log("%s %s WARN - %s", new Date().toISOString(), this.logger, message);
    }
    error(message) {
        if ((this.level & ERROR) === ERROR)
            console.log("%s %s ERROR - %s", new Date().toISOString(), this.logger, message);
    }
    error(message, error) {
        if ((this.level & ERROR) === ERROR && error)
            console.log("%s %s ERROR - %s%s", new Date().toISOString(), this.logger, message, error);
    }

}

module.exports = Logger;

