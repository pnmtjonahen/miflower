class CLIOptions {
    constructor() {
        this.logLevel = 0b1110; // default no DEBUG (ERROR, WARN, INFO)

        if (process.argv.find((val) => val === 'DEBUG=true')) {
            this.logLevel = 0b1111; // turnon DEBUG logging
        }

        const  cliTimeout = process.argv.find((val) => val.startsWith('timeout='));
        this.timeout = 1000 * 60 * 5; // default 5 minutes wait period
        if (cliTimeout) {
            this.timeout = cliTimeout.split('=')[1];
        }
    }
}

module.exports = new CLIOptions();



