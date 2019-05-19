import bodyParser from 'body-parser'
import express from 'express'
import * as fs from 'fs'
import * as cv from 'opencv4nodejs'
import * as path from 'path'
import SpriteLocator, { LocatorResult } from './spriteLocator'
import VideoSource from './video-source'
const cors = require('cors')
const debug = require('debug')


const d = debug('main')

const videoFile = './src/public/vids/SNES_Longplay_[315]_The_Legend_of_Zelda_-_A_Link_to_the_Past_(a)-Z6hjG6MCcZ8.mp4'

const kernelSize = 19
const cvKernelSize = new cv.Size(kernelSize, kernelSize)

let mapMat: cv.Mat
let frameMask: cv.Mat
let matches: cv.Mat

const vs = new VideoSource(videoFile)
const spriteLocator = new SpriteLocator('./src/public/sprites')

let currentFrame: number = 1300
let currentPos = { x: 0, y: 0 }
let maxLoc = { x: 0, y: 0 }
let minLoc = { x: 0, y: 0 }
let currentMap: Buffer = Buffer.alloc(288 * 224 * 3)
let spriteLocations: LocatorResult[] = []

const app = express()

vs.on('frame', () => {
    d('frame')
    vs.pause()
    spriteLocations = spriteLocator
        .parseFrame(vs.currentFrame, vs.width, vs.height)
    matches = spriteLocations[0].matchesMat

    currentFrame++
    vs.resume()
})

app.use(cors())
app.use(bodyParser.json())
app.get('/frame', (req, res, next) => {
    d('app.get "frame"')
    // d(spritePositions[0])
    // d('app.get "frame"', {
    //     currentFrame: vs.currentFrame,
    //     minLoc,
    //     maxLoc,
    //     matches
    // })
    if (!vs.currentFrame || !minLoc || !maxLoc || !matches) {
        next()
        d('app.get "missing data"')
        d("vs.currentFrame", typeof vs.currentFrame)
        d("minLoc", typeof minLoc)
        d("maxLoc", typeof maxLoc)
        d("matches", typeof matches)
        return
    }
    res.json({
        frame: Array.from(vs.currentFrame),
        minLoc: Object.assign(minLoc, { w: 288 / 4, h: 224 / 4 }),
        maxLoc: Object.assign(maxLoc, { w: 288 / 4, h: 224 / 4 }),
        // pos: Object.assign(currentPos, { w: 288 / 4, h: 224 / 4 }),
        // map: Array.from(currentMap),
        // matches: {
        //     data: Array.from(matches.getData()),
        //     w: matches.cols,
        //     h: matches.rows,
        // },
        sprites: spriteLocations.map((value: LocatorResult): any => {
            const result = value as any
            result.matches = Array.from(value.matches)
            result.item = Array.from(value.item)
            return result
        })
    })
})

app.use('/', express.static('./src'))
app.listen(8081)

interface Location {
    x: number
    y: number
}

vs.start()
d('INIT')