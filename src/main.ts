import * as fs from 'fs'
import * as cv from 'opencv4nodejs'
import * as path from 'path'
import AlttpServer from './server'
import SpriteLocator, { LocatorResult } from './spriteLocator'
import VideoSource from './video-source'
const d = require('debug')('ALTTP.IO.main')

const videoFile = './src/public/vids/SNES_Longplay_[315]_The_Legend_of_Zelda_-_A_Link_to_the_Past_(a)-Z6hjG6MCcZ8.mp4'

let matches: cv.Mat

const vs = new VideoSource({
    filePath: videoFile,
    start: 1300
})
const spriteLocator = new SpriteLocator('./src/public/spr')

let currentFrame: number = 1300
let spriteLocations: LocatorResult[] = []

vs.on('frame', () => {
    d('frame')
    vs.pause()
    spriteLocations = spriteLocator
        .parseFrame(vs.currentFrame, vs.width, vs.height)
    matches = spriteLocations[0].matchesMat
    currentFrame++
    setTimeout(vs.resume, 100)
})

const server = new AlttpServer({
    getCurrentFrameNumber: () => currentFrame,
    getMatches: () => matches,
    getCurrentFrame: () => vs.currentFrame,
    getSpriteLocations: () => spriteLocations
})


vs.start()
d('INIT')