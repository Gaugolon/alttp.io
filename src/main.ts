import * as fs from 'fs'
import * as cv from 'opencv4nodejs'
import * as path from 'path'
import AlttpServer from './server'
import SpriteLocator, { LocatorResult } from './spriteLocator'
import VideoSource from './video-source'
const d = require('debug')('ALTTP.IO.main')
const { Worker } = require('worker_threads')

const videoFile = './src/public/vids/SNES_Longplay_[315]_The_Legend_of_Zelda_-_A_Link_to_the_Past_(a)-Z6hjG6MCcZ8.mp4'

let matches: cv.Mat = new cv.Mat()

const vs = new VideoSource({
    filePath: videoFile,
    start: 1300
})
const spriteLocator = new SpriteLocator('./src/public/spr')

let currentFrameCount: number = 1300
let currentFrame: Uint8ClampedArray = new Uint8ClampedArray(0)
let spriteLocations: LocatorResult[] = []

// vs.on('frame', () => {
//     d('frame')
//     vs.pause()
//     spriteLocations = spriteLocator
//         .parseFrame(vs.currentFrame, vs.width, vs.height)
//     matches = spriteLocations[0].matchesMat
//     currentFrame++
//     setTimeout(vs.resume, 100)
// })


const worker = new Worker('./src/VideoSourceWorker.js')
worker.once('message', (message: MessageEvent) => {
    const config = {
        width: 258,
        height: 224,
        colors: 3,
        filePath: videoFile,
        start: 1325,
        autoPause: true,
        spritesDirectory: path.resolve('./src/public/spr')
    }
    worker.postMessage(JSON.stringify(config))
    worker.on('message', (message: string) => {
        const data = JSON.parse(message)
        const buffer = Buffer.from(data.currentFrame, 'base64')
        currentFrame = Uint8ClampedArray.from(buffer)
        spriteLocations = spriteLocator
            .parseFrame(currentFrame, config.width, config.height)
        matches = spriteLocations[0].matchesMat
        currentFrameCount = data.frameCount
        worker.postMessage(JSON.stringify({ cmd: 'resume' }))
    })
})
Promise.resolve()

const server = new AlttpServer({
    getCurrentFrameNumber: () => currentFrameCount,
    getMatches: () => matches,
    getCurrentFrame: () => currentFrame,
    getSpriteLocations: () => spriteLocations
})

d('INIT')