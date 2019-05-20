import * as path from 'path'
import { LocatorResult } from './spriteLocator'
import bodyParser from 'body-parser'
import express from 'express'
const cors = require('cors')
const d = require('debug')('ALTTP.IO.AlttpServer')
import * as cv from 'opencv4nodejs'

const defaultConfig = {
    port: 8081,
    getCurrentFrameNumber: () => 0,
    getCurrentFrame: () => new Uint8ClampedArray(0),
    getMatches: () => new cv.Mat(),
    getSpriteLocations: () => []
}

export default class AlttpServer {

    private express = express()
    private lastFrame: number = 0

    constructor(private config: AlttpServerConfig = defaultConfig) {
        if (this.config) {
            this.config = Object.assign(defaultConfig, this.config)
        }

        this.express.use(cors())
        this.express.use(bodyParser.json())
        this.express.get('/frame', (req, res, next) => {
            d('app.get "frame"')
            const currentFrameNumber = this.config.getCurrentFrameNumber()

            if (currentFrameNumber === this.lastFrame) {
                next()
                return
            }
            this.lastFrame = currentFrameNumber
            // d(spritePositions[0])
            // d('app.get "frame"', {
            //     currentFrame: vs.currentFrame,
            //     minLoc,
            //     maxLoc,
            //     matches
            // })
            // if (!vs.currentFrame || !minLoc || !maxLoc || !matches) {
            //     next()
            //     d('app.get "missing data"')
            //     d("vs.currentFrame", typeof vs.currentFrame)
            //     d("minLoc", typeof minLoc)
            //     d("maxLoc", typeof maxLoc)
            //     d("matches", typeof matches)
            //     return
            // }

            const currentFrame = this.config.getCurrentFrame()
            const matches = this.config.getMatches()
            const spriteLocations = this.config.getSpriteLocations()

            res.json({
                frame: Array.from(currentFrame),
                // minLoc: Object.assign(minLoc, { w: 288 / 4, h: 224 / 4 }),
                // maxLoc: Object.assign(maxLoc, { w: 288 / 4, h: 224 / 4 }),
                // pos: Object.assign(currentPos, { w: 288 / 4, h: 224 / 4 }),
                // map: Array.from(currentMap),
                matches: {
                    data: Array.from(matches.getData()),
                    w: matches.cols,
                    h: matches.rows,
                },
                sprites: spriteLocations.map((value: LocatorResult): any => {
                    const result = value as any
                    result.matches = Array.from(value.matches)
                    result.item = Array.from(value.item)
                    return result
                })
            })
        })

        this.express.use('/', express.static(
            path.resolve(__dirname, 'public/www'))
        )
        this.express.use('/public', express.static(
            path.resolve(__dirname, 'public'))
        )
        this.express.listen(8081)
    }
}

export interface AlttpServerConfig {
    port?: number,
    getCurrentFrameNumber?: () => number
    getCurrentFrame?: () => Uint8ClampedArray
    getMatches?: () => cv.Mat
    getSpriteLocations?: () => LocatorResult[]
}