/*
 * Main MiFlower poller.
 */
const noble = require('noble');
const Logger = require('./logging');
const cliOptions = require("./clioptions");
let logger = new Logger("main", cliOptions.logLevel);


const DEFAULT_DEVICE_NAME = 'Flower care';
const DATA_SERVICE_UUID = '0000120400001000800000805f9b34fb';
const OTHER_SERVICE_UUID = '0000120600001000800000805f9b34fb';
const DATA_CHARACTERISTIC_UUID = '00001a0100001000800000805f9b34fb';
const FIRMWARE_CHARACTERISTIC_UUID = '00001a0200001000800000805f9b34fb';
const REALTIME_CHARACTERISTIC_UUID = '00001a0000001000800000805f9b34fb';
const REALTIME_META_VALUE = Buffer.from([0xA0, 0x1F]);
const SERVICE_UUIDS = [DATA_SERVICE_UUID];
const CHARACTERISTIC_UUIDS = [DATA_CHARACTERISTIC_UUID, FIRMWARE_CHARACTERISTIC_UUID, REALTIME_CHARACTERISTIC_UUID];

// peripherals array, these are the peripherals we already are trying to connect.
const peripherals = [];


noble.on('discover', function (peripheral) {
    if (peripheral.advertisement.localName !== DEFAULT_DEVICE_NAME) {
        return; // ignore non miflora devices
    }
    logger.debug(`peripheral=${peripheral.id} discover : ${peripheral}`);

    if (peripheral.state === 'disconnected') {
        if (!peripherals.find((p) => p.peripheral.id === peripheral.id)) {
            peripherals.push({peripheral:peripheral, last:Date.now()});
            setupPeripheral(peripheral);
        } else {
            logger.debug(`peripheral=${peripheral.id} found same peripheral in state ${peripheral.state} ignoring...`);
        }
    } else {
        logger.debug(`peripheral=${peripheral.id} found peripheral in state ${peripheral.state} ignoring...`);
    }
});

function debugCharacteristics(peripheral, dataCharacteristic, realtimeCharacteristic, firmwareCharacteristic) {
    logger.debug(`peripheral=${peripheral.id} dataCharacteristics=${dataCharacteristic}`);
    logger.debug(`peripheral=${peripheral.id} realtimeCharacteristics=${realtimeCharacteristic}`);
    logger.debug(`peripheral=${peripheral.id} firmwareCharacteristics=${firmwareCharacteristic}`);

    dataCharacteristic.discoverDescriptors((error, descriptors) => {
        if (error) {
            logger.error(`peripheral=${peripheral.id} characteristics=${dataCharacteristic.uuid} data:discoverDescriptor - error :${error}`);
        } else {
            logger.debug(`peripheral=${peripheral.id} characteristics=${dataCharacteristic.uuid} data:discoverDescriptor ${descriptors}`);
        }
    });
    realtimeCharacteristic.discoverDescriptors((error, descriptors) => {
        if (error) {
            logger.error(`peripheral=${peripheral.id} characteristics=${realtimeCharacteristic.uuid} realtime:discoverDescriptor - error :${error}`);
        } else {
            logger.debug(`peripheral=${peripheral.id} characteristics=${realtimeCharacteristic.uuid} realtime:discoverDescriptor ${descriptors}`);
        }
    });
    firmwareCharacteristic.discoverDescriptors((error, descriptors) => {
        if (error) {
            logger.error(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware:discoverDescriptor - error :${error}`);
        } else {
            logger.debug(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware:discoverDescriptor ${descriptors}`);
        }
    });

}

function reConnect(peripheral) {
    peripheral.disconnect((error) => {
        if (error) {
            logger.error(`peripheral=${peripheral.id} disconnect error :${error}`);
            return;
        }
        logger.debug(`peripheral=${peripheral.id} disconnect will re-connect in ${cliOptions.reconnect} seconds`);

        setTimeout(() => {
            logger.debug(`peripheral=${peripheral.id} re-connect`);
            setupPeripheral(peripheral);
        }, cliOptions.reconnect);

    });

}
/**
 * setup the peripheral event handlers and connect to it. 
 * @param {type} peripheral the peripheral to setup
 */
function setupPeripheral(peripheral) {

    peripheral.connect((error) => {
        if (error) {
            logger.error(`peripheral=${peripheral.id} connect - error :${error}`);
            reConnect(peripheral);
            return;
        }
        logger.debug(`peripheral=${peripheral.id} connected`);

        peripheral.discoverSomeServicesAndCharacteristics(SERVICE_UUIDS, CHARACTERISTIC_UUIDS, function (error, services, characteristics) {
            if (error) {
                logger.error(`peripheral=${peripheral.id} discover error ${error}`);
                reConnect(peripheral);
                return;
            }
            logger.debug(`peripheral=${peripheral.id} discover DATA-SERVICES - services=${services} - characteristics=${characteristics}`);
            let dataCharacteristic;
            let realtimeCharacteristic;
            let firmwareCharacteristic;

            characteristics.forEach((characteristic) => {
                switch (characteristic.uuid) {
                    case DATA_CHARACTERISTIC_UUID:
                        dataCharacteristic = characteristic;
                        break;
                    case FIRMWARE_CHARACTERISTIC_UUID:
                        firmwareCharacteristic = characteristic;
                        break;
                    case REALTIME_CHARACTERISTIC_UUID:
                        realtimeCharacteristic = characteristic;
                        break;
                }
            });
            debugCharacteristics(peripheral, dataCharacteristic, realtimeCharacteristic, firmwareCharacteristic);

            firmwareCharacteristic.read((error, data) => {
                if (error) {
                    logger.error(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware:read - error :${error}`);
                } else {
                    logger.info(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware={ "deviceId": "${peripheral.id}", "batteryLevel": ${parseInt(data.toString('hex', 0, 1), 16)}, "firmwareVersion": "${data.toString('ascii', 2, data.length)}" } }`);
                }
            });


// write a magic number so we can read the current data
            logger.debug(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware:write`);
            realtimeCharacteristic.write(REALTIME_META_VALUE, false);

            dataCharacteristic.read((error, data) => {
                if (error) {
                    logger.error(`peripheral=${peripheral.id} characteristics=${dataCharacteristic.uuid} read error :${error}`);
                    return;
                }
                let temperature = data.readUInt16LE(0) / 10;
                let lux = data.readUInt32LE(3);
                let moisture = data.readUInt16BE(6);
                let fertility = data.readUInt16LE(8);
                logger.info(`peripheral=${peripheral.id} data={"deviceId": "${peripheral.id}", "temperature": ${temperature}, "lux": ${lux}, "moisture": ${moisture}, "fertility": ${fertility} }`);
                peripherals.find(p => p.peripheral.id === peripheral.id).last = Date.now();
                reConnect(peripheral);
            });
        });
    });
}
;

noble.on('scanStart', () => {
    logger.debug('noble:onScanStart');
});
noble.on('scanStop', () => {
    logger.debug('noble:onScanStop');
    if (peripherals.length < cliOptions.nrdevices) {
        setTimeout(() => {
            noble.startScanning([], true, (error) => {
                if (error) {
                    logger.error(`noble:startScanning ${error}`);
                }
            });
        }, cliOptions.rescan); // rescan after x seconds

    }
});

noble.on('warning', (message) => {
    logger.debug(`noble:onWarning: ${message}`);
});

noble.on('stateChange', (state) => {
    logger.debug(`noble:onStateChange : ${state}`);
    if (state === 'poweredOn') {
        noble.startScanning([], true, (error) => {
            if (error) {
                logger.error(`noble:startScanning ${error}`);
            }
        });
    } else {
        noble.stopScanning();
    }
});

/*
 * Workaround for a bug, number of issues are reported that when a disconnect takes place during connect, no error is correctly propocated
 * So we wait 2 * reconnect timeout and find all peripherals that have not reported any data, disconnect them. and reconntect. 
 *
 */
setInterval(() => {
    logger.debug("house keeping checking for stale connections...");
    peripherals.filter((p) => p.last < (Date.now() - (2 * cliOptions.reconnect))).forEach((p) => {
        logger.debug(`peripheral=${p.peripheral.id} no data since ${new Date(p.last).toISOString()} reConnecting..`);
        reConnect(p.peripheral);
    });
}, cliOptions.reconnect);

function handle(signal) {
    noble.stopScanning((e) => {
        if (e) {
            logger.error("noble:stopScanning ", e);

        } else {
            logger.debug("noble:stopScanning");
        }
        process.exit();
    });
    logger.debug(`Signal received : ${signal}`);
}

process.on('SIGINT', handle);
process.on('SIGTERM', handle);

process.on('warning', (warning) => {
    logger.debug(`process:warning ${warning.name} - ${warning.message} - ${warning.stack}`);
});

