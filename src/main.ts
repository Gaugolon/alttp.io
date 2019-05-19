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

let mapMat: cv.Mat = new cv.Mat(Buffer.alloc(10000), 100, 100, cv.CV_8UC3)
let frameMask: cv.Mat = new cv.Mat(Buffer.alloc(10000), 100, 100, cv.CV_8UC3)
let matches: cv.Mat = new cv.Mat(Buffer.alloc(10000), 100, 100, cv.CV_8UC3)





const vs = new VideoSource(videoFile)
const spriteLocator = new SpriteLocator('./src/public/sprites')

let currentFrame: number = 1300
let currentPos = { x: 0, y: 0 }
let maxLoc = { x: 0, y: 0 }
let minLoc = { x: 0, y: 0 }
let currentMap: Buffer = Buffer.alloc(288 * 224 * 3)
let spriteLocations: LocatorResult[] = []

const app = express()


const spritePositions = spriteLocator
    .parseFrame(
        Uint8ClampedArray.from(
            cv.imread('./src/public/maps/light_world-2.jpg')
                .cvtColor(cv.COLOR_BGR2RGB)
                .getData()
        ),
        4096,
        4096
    )

// console.log(spritePositions.map((item) => item.sprites))
spritePositions[0].matchesMat = spritePositions[0].matchesMat.rescale(1 / 4)
spritePositions[0].matches = Uint8ClampedArray
    .from(spritePositions[0].matchesMat.getData())
d(spritePositions[0].matches.length)


const frame2Mat = (data: Uint8ClampedArray, w: number, h: number, c: number): cv.Mat => {
    return new cv.Mat(Buffer.from(data), w, h, cv.CV_8UC3)
}
vs.on('frame', () => {
    d('frame')
    return
    vs.pause()
    const frameMat = frame2Mat(vs.currentFrame, vs.width, vs.height, vs.colors)
    const spritePositions = spriteLocator.parseFrame(vs.currentFrame, vs.width, vs.height)
    spriteLocations = spritePositions
    console.log(currentFrame, spritePositions[0].sprites.length)
    // find(frameMat);

    currentFrame++
    vs.resume()
})

app.use(cors())
app.use(bodyParser.json())
app.get('/frame', (req, res, next) => {
    d('app.get "frame"')
    d(spritePositions[0])
    // d('app.get "frame"', {
    //     currentFrame: vs.currentFrame,
    //     minLoc,
    //     maxLoc,
    //     matches
    // })
    if (!vs.currentFrame)
        return
    if (!minLoc)
        return
    if (!maxLoc)
        return
    if (!matches)
        return

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
        matches: {
            data: Array.from(spritePositions[0].matches),
            w: spritePositions[0].matchesMat.cols,
            h: spritePositions[0].matchesMat.rows,
        }
        // sprites: spriteLocations.map((value: LocatorResult) => {
        //     const result = value as any
        //     result.matches = Array.from(value.matches)
        //     result.item = Array.from(value.item)
        //     return result
        // })
    })
})

app.use('/', express.static('./src'))
app.listen(8081)


const find = (frame: cv.Mat): Location | boolean => {
    d('find')
    // Load images
    if (!mapMat) {
        const fPath = path.resolve('./src/public/maps/light_world-2.jpg')
        mapMat = cv.imread(fPath)
            // .cvtColor(cv.COLOR_BGR2GRAY);
            .cvtColor(cv.COLOR_BGR2RGB)
        // .rotate(cv.ROTATE_90_COUNTERCLOCKWISE);
    }
    if (!frameMask) {
        const fPath = path.resolve('./src/public/maps/mask.jpg')
        frameMask = cv.imread(fPath)
            // .cvtColor(cv.COLOR_BGR2GRAY)
            .cvtColor(cv.COLOR_BGR2RGB)
            .rotate(cv.ROTATE_90_CLOCKWISE)
    }

    // console.log({
    //     frame, frameMask, mapMat
    // });


    let originalMat: cv.Mat = mapMat.copy()
    // cv.BRG

    // originalMat.blurAsync(cvKernelSize);
    // console.log(originalMat);

    // frame.blurAsync(cvKernelSize);

    // Match template (the brightest locations indicate the highest match)
    // const matchesModes = [];
    // for (let i = 0; i <= 5; i++) {
    //     matchesModes[i] = originalMat.cvtColor(cv.COLOR_BGR2GRAY)
    //         .matchTemplate(frame.cvtColor(cv.COLOR_BGR2GRAY), i).minMaxLoc();
    // }

    const scale = 1 / 16


    matches = originalMat
        .cvtColor(cv.COLOR_BGR2GRAY)
        .rescale(scale)
        .blur(cvKernelSize)
        // .cvtColor(cv.COLOR_BGR2GRAY)
        .matchTemplate(
            frame
                .cvtColor(cv.COLOR_BGR2GRAY)
                .rescale(scale)
                .blur(cvKernelSize),
            5
            // frameMask
            //     .rescale(scale)
            //     .blur(cvKernelSize),
            // .cvtColor(cv.COLOR_BGR2GRAY)
        )
    console.log(matches)

    // console.log({ matched, frame });

    // matchedMask = matched.getData();
    // console.log(matchedMask);

    // Use minMaxLoc to locate the highest value (or lower, depending of the type of matching method)
    const minMax = matches.minMaxLoc()
    // const { minLoc: { x, y } } = minMax;
    const { maxLoc: { x, y } } = minMax
    maxLoc = { x: minMax.maxLoc.x / scale, y: minMax.maxLoc.y / scale }
    minLoc = { x: minMax.minLoc.x / scale, y: minMax.minLoc.y / scale }
    // console.log(currentPos);

    // Draw bounding rectangle
    originalMat = originalMat.rescale(1 / 4)
    originalMat.drawRectangle(
        new cv.Rect(
            x / scale,
            y / scale,
            frame.rows / scale,
            frame.cols / scale
        ),
        new cv.Vec3(0, 255, 0),
        2,
        cv.LINE_8
    )

    // currentMap = originalMat.getData();


    // Open result in new window
    // cv.imshow('We\'ve found Waldo!', originalMat);
    // cv.waitKey();
    // return await originalMat.getData();
    if (x !== 0 && y !== 0)
        return { x, y }

    return false
}


interface Location {
    x: number
    y: number
}

// vs.start()
d('INIT')