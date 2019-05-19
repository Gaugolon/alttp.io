import * as fs from 'fs'
import * as cv from 'opencv4nodejs'
import * as path from 'path'
const debug = require('debug');
const d = debug('SpriteLocator')



export default class SpriteLocator {
  private sprites: cv.Mat[] = []
  constructor(private spritesDirectory: string) {
    d('construct')
    fs.readdirSync(spritesDirectory).forEach((file) => {
      const fullPath = path.resolve(this.spritesDirectory, file)
      const spriteMat = cv
        .imread(fullPath)
        .cvtColor(cv.COLOR_BGR2RGB)
      // .blur(new cv.Size(2, 2))

      this.sprites.push(spriteMat)
    })
  }

  public parseFrame(
    frameData: Uint8ClampedArray,
    width: number,
    height: number
  ): LocatorResult[] {
    d('parseFrame')
    const result: LocatorResult[] = []
    const buffer = Buffer.from(frameData)
    const frameMat = (new cv.Mat(buffer, height, width, cv.CV_8UC3))
    // .cvtColor(cv.COLOR_BGR2RGB)

    const kernelSize = 7
    const cvKernelSize = new cv.Size(kernelSize, kernelSize)

    this.sprites.forEach((spriteMat) => {
      const sprites: Sprite[] = []
      const matches = frameMat
        // .cvtColor(cv.COLOR_RGB2GRAY)
        // .rescale(scale)
        .blur(cvKernelSize)
        .blur(cvKernelSize)
        .blur(cvKernelSize)
        .matchTemplate(
          spriteMat
            // .cvtColor(cv.COLOR_RGB2GRAY),
            // .rescale(scale)
            .blur(cvKernelSize)
            .blur(cvKernelSize)
            .blur(cvKernelSize),
          5
          // frameMask
          //     .rescale(scale)
          //     .blur(cvKernelSize),
          // .cvtColor(cv.COLOR_BGR2GRAY)
        )

      // console.log(matches.getData())

      const threshold = 254
      const loc = this.extractLocation(matches, threshold)
      // const minMax = matches.minMaxLoc();
      // const { maxLoc: { x, y } } = minMax;
      // const maxLoc = { x: minMax.maxLoc.x, y: minMax.maxLoc.y };
      // const minLoc = { x: minMax.minLoc.x, y: minMax.minLoc.y };
      loc.forEach((location) => {
        sprites.push({
          x: location.x,
          y: location.y,
          w: spriteMat.cols,
          h: spriteMat.rows,
          spriteName: "unknown",
        })
      })

      result.push({
        sprites,
        item: Uint8ClampedArray.from(spriteMat.getData()),
        matches: Uint8ClampedArray.from(matches.getData()),
        matchesMat: matches,
      })

    })


    return result
  }

  private extractLocation(mat: cv.Mat, threshold: number): Location[] {
    d('extractLocation')
    const result: Location[] = []

    const matData = mat.getData()
    matData.forEach((data, i) => {
      if (data > threshold) {
        result.push({
          x: i % mat.rows,
          y: Math.floor(i / mat.cols)
        })
      }
    })

    return result
  }

}

interface Location {
  x: number
  y: number
}

interface Sprite {
  x: number
  y: number
  w: number
  h: number
  spriteName: string
}

export interface LocatorResult {
  sprites: Sprite[]
  item: Uint8ClampedArray
  matches: Uint8ClampedArray
  matchesMat: cv.Mat
}