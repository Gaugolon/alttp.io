const { parentPort } = require('worker_threads');
const child_process = require('child_process')
const d = require('debug')('ALTTP.IO.videoSourceWorker')

const DefaultVideoSourceConfig = {
    width: 258,
    height: 224,
    colors: 3,
    start: 0
}
let options = DefaultVideoSourceConfig
let buffer,
    bufferOffset,
    byteSize,
    currentFrame,
    frameCount,
    subprocess,
    spritesDirectory,
    sprites



parentPort.once('message', (message) => {
    options = Object.assign(DefaultVideoSourceConfig, JSON.parse(message));
    d(options)
    byteSize = options.width * options.height * options.colors;
    buffer = Buffer.alloc(byteSize)
    bufferOffset = 0
    frameCount = 0
    run()
})

function run() {
    subprocess = child_process.spawn('ffmpeg', [
        "-ss", `${options.start}`,
        "-i", options.filePath,
        "-an",
        "-hide_banner",
        "-vf", `scale=w=${options.width}:h=${options.height}`,
        "-pix_fmt", "rgb24",
        "-c:v", "rawvideo",
        "-f", "rawvideo",
        "-"
    ])
    subprocess.stdout.on('data', (data) => processData(data))
    // subprocess.stderr.on('data', (data) => d(data.toString()))
    subprocess.addListener('exit', () => terminate())

    parentPort.on('message', (message) => d(`Received message ${message}`))

    parentPort.on('message', (message) => {
        const data = JSON.parse(message)
        switch (data.cmd) {
            case 'pause':
                subprocess.stdout.pause()
                break;
            case 'resume':
                subprocess.stdout.resume()
                break;

        }
    })
}



function processData(data) {
    for (let i = 0; i < data.length; i++) {
        buffer[bufferOffset] = data.readUInt8(i)
        bufferOffset = (bufferOffset + 1) % byteSize
        if (bufferOffset == 0) {
            currentFrame = buffer.toString('base64')
            parentPort.postMessage(JSON.stringify({
                currentFrame,
                frameCount
            }))
            if (options.autoPause)
                subprocess.stdout.pause()
            frameCount++
        }
    }
}

parentPort.postMessage('READY')
