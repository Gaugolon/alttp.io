const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { ChildProcess } = require('child_process')
const d = require('debug')('videoSourceWorker')

setInterval(() => {
    parentPort.postMessage('TEST')
}, 1000)
