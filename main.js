let logLevel = 0b1110; // default no DEBUG (ERROR, WARN, INFO)

if (process.argv.find((val) => val === 'DEBUG=true')) {
    logLevel = 0b1111; // turnon DEBUG logging
}

const  cliTimeout = process.argv.find((val) => val.startsWith('timeout='));
let timeout = 1000* 60 * 5; // default 5 minutes wait period
if (cliTimeout) {
    timeout = cliTimeout.split('=')[1];
}

const noble = require('noble');
const Logger = require('./logging');
let logger = new Logger("main", logLevel); 


const DEFAULT_DEVICE_NAME = 'Flower care';

const DATA_SERVICE_UUID = '0000120400001000800000805f9b34fb';
const OTHER_SERVICE_UUID = '0000120600001000800000805f9b34fb';

const DATA_CHARACTERISTIC_UUID = '00001a0100001000800000805f9b34fb';
const FIRMWARE_CHARACTERISTIC_UUID = '00001a0200001000800000805f9b34fb';
const REALTIME_CHARACTERISTIC_UUID = '00001a0000001000800000805f9b34fb';
const DEVICE_NAME_UUID = '2a00';
const APPEARANCE_UUID = '2a01';

const REALTIME_META_VALUE = Buffer.from([0xA0, 0x1F]);

const SERVICE_UUIDS = [DATA_SERVICE_UUID];
const CHARACTERISTIC_UUIDS = [DATA_CHARACTERISTIC_UUID, FIRMWARE_CHARACTERISTIC_UUID, REALTIME_CHARACTERISTIC_UUID, DEVICE_NAME_UUID, APPEARANCE_UUID];

// called when a new peripheral is discovered
noble.on('discover', function (peripheral) {
    logger.debug(`peripheral=${peripheral.id} discover : ${peripheral}`);

    if (peripheral.advertisement.localName !== DEFAULT_DEVICE_NAME) {
        return; // ignore non miflora devices
    }


    if (peripheral.state !== 'disconnected') {
        logger.debug(`peripheral=${peripheral.id} already connected`);
        return; // ignore already connected devices, this happens when we do a rescan, while still connected to a peripheral?
    }

    connect(peripheral);
});


function connect(peripheral) {
    peripheral.once('disconnect', () => {
        logger.debug(`peripheral=${peripheral.id} disconnect`);
        // om disconnect wait a few seconds and re-connect
        setTimeout(() => {
            logger.debug(`peripheral=${peripheral.id} re-connect`);
            connect(peripheral);
        }, timeout); // reconnect after x seconds
    });

    peripheral.once('rssiUpdate', (rssi) => {
        logger.debug(`peripheral=${peripheral.id} rssiUpdate=${rssi}`);
    });

    peripheral.once('servicesDiscover', (services) => {
        logger.debug(`peripheral=${peripheral.id} servicesDiscover=${services}`);
    });
    // connect peripheral
    peripheral.connect((e) => {
        logger.error(`peripheral=${peripheral.id} connect - error :`, e);
        logger.debug(`peripheral=${peripheral.id} connected`);
        logger.debug(`peripheral=${peripheral.id} connect`);

        peripheral.discoverSomeServicesAndCharacteristics(SERVICE_UUIDS, CHARACTERISTIC_UUIDS, function (error, services, characteristics) {
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
            logger.debug(`peripheral=${peripheral.id} dataCharacteristics=${dataCharacteristic}`);
            logger.debug(`peripheral=${peripheral.id} realtimeCharacteristics=${realtimeCharacteristic}`);
            logger.debug(`peripheral=${peripheral.id} firmwareCharacteristics=${firmwareCharacteristic}`);

            dataCharacteristic.discoverDescriptors((error, descriptors) => {
                logger.error(`peripheral=${peripheral.id} characteristics=${dataCharacteristic.uuid} data:discoverDescriptor - error :`, error);
                logger.debug(`peripheral=${peripheral.id} characteristics=${dataCharacteristic.uuid} data:discoverDescriptor ${descriptors}`);
            });
            realtimeCharacteristic.discoverDescriptors((error, descriptors) => {
                logger.error(`peripheral=${peripheral.id} characteristics=${realtimeCharacteristic.uuid} realtime:discoverDescriptor - error :`, error);
                logger.debug(`peripheral=${peripheral.id} characteristics=${realtimeCharacteristic.uuid} realtime:discoverDescriptor ${descriptors}`);
            });
            firmwareCharacteristic.discoverDescriptors((error, descriptors) => {
                logger.error(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware:discoverDescriptor - error :`, error);
                logger.debug(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware:discoverDescriptor ${descriptors}`);
            });

            firmwareCharacteristic.read((error, data) => {
                logger.error(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware:read - error :`, error);
                logger.debug(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware:read firmware={ deviceId: ${peripheral.id}, batteryLevel: ${parseInt(data.toString('hex', 0, 1), 16)}, firmwareVersion: ${data.toString('ascii', 2, data.length)} } }`);
            });

            logger.debug(`peripheral=${peripheral.id} characteristics=${firmwareCharacteristic.uuid} firmware:write - write a magic number so we can read the current data`);
            realtimeCharacteristic.write(REALTIME_META_VALUE, false);

            dataCharacteristic.read((error, data) => {
                logger.error(`peripheral=${peripheral.id} characteristics=${dataCharacteristic.uuid} read error :`, error);

                let temperature = data.readUInt16LE(0) / 10;
                let lux = data.readUInt32LE(3);
                let moisture = data.readUInt16BE(6);
                let fertility = data.readUInt16LE(8);
                logger.info(`peripheral=${peripheral.id} data={deviceId: ${peripheral.id}, temperature: ${temperature}, lux: ${lux}, moisture: ${moisture}, fertility: ${fertility} }`);
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
});

noble.on('warning', (message) => {
    logger.debug(`noble:onWarning: ${message}`);
});

noble.on('stateChange', (state) => {
    logger.debug(`noble:stateChange : ${state}`);
    if (state === 'poweredOn') {
        noble.startScanning([], true, (e) => {
            logger.error("noble:startScanning ", e);
        });
    } else {
        noble.stopScanning();
    }
});


function handle(signal) {
    noble.stopScanning((e) => {
        logger.debug("noble:stopScanning");
        logger.error("noble:stopScanning ", e);
        process.exit();
    });
    logger.debug("Signal received : " + signal);
}

process.on('SIGINT', handle);
process.on('SIGTERM', handle);

process.on('warning', (warning) => {
    logger.debug(warning.name);    // Print the warning name
    logger.debug(warning.message); // Print the warning message
    logger.debug(warning.stack);   // Print the stack trace
});

