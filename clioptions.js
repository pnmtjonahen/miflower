/*
 * Command Line Options, specify in key=value syntax
 */
class CLIOptions {
    constructor() {
        this.logLevel = 0b1110; // default no DEBUG (ERROR, WARN, INFO, DEBUG)

        if (process.argv.find((val) => val === 'DEBUG=true')) {
            this.logLevel = 0b1111; // turn on DEBUG logging
        }

        this.reconnect = this.getOption('reconnect=', 1000 * 60 * 5); // default 5 minutes wait period
        this.rescan = this.getOption('rescan=', 1000 * 60 * 5); // default 5 minutes wait period
        this.nrdevices = this.getOption('nrdevices=', 2);
        
    }
    
    getOption(optionName, defaultValue) {
        const  clivalue = process.argv.find((val) => val.startsWith(optionName));
        if (clivalue) {
            return clivalue.split('=')[1];
        }
        return defaultValue;
    }
}

module.exports = new CLIOptions();



