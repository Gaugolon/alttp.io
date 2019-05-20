const { parentPort } = require('worker_threads');
const d = require('debug')('ALTTP.IO.spriteLocatorWorker')

parentPort.on('message', (data) => {
    options = JSON.parse(data)
    if (!options.frame)
        terminate()
    if (!options.sprite)
        terminate()
})


parentPort.postMessage('READY')