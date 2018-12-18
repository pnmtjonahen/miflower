# MiFlower

My node.js implementation of a MiFlower poller

## How it works
1. start noble scanning for all devices.
1.1 when scanning is stopped,check of all required devices are found. If not wait a number of seconds and rescan.
2. when a device is found first check if it is a "Flower care" peripheral.
3. check the peripheral status. If it is disconnected continue. Other statuses can be connected, connecting, which happen when a scan takes place when we are also connecting or already connected.
4. connect to the peripheral.
5. if connected then get the device characteristics. firmware, data, and some magic.
6. reading firmware gets us the version number and battery status.
7. reading the data characteristics get us the values for lux, temperature, moisture and fertility. However to get meaning full data we need to write a magic value.
8. after getting all data disconnect from the peripheral
9. when disconnected wait a specific number of seconds and rerun the same method (connect, get data, disconnect)
 
## Questions
1. why is the peripheral disconnecting when a on data event handle is set? You can connect set the on data event handle get some data and then a disconnect takes place
2. The app is downloading data. Historic data how is this done?

## sources
- https://www.open-homeautomation.com/2016/08/23/reverse-engineering-the-mi-plant-sensor/
- https://www.bluetooth.com/specifications/gatt/characteristics
- https://github.com/noble/noble
- https://github.com/open-homeautomation/miflora
- https://github.com/Ordina-JTech/jsroots-moestuin-workshop

