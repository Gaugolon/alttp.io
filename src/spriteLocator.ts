import * as fs from 'fs'
import * as cv from 'opencv4nodejs'
import * as path from 'path'
import { CV_8SC4, CV_8SC3 } from 'opencv4nodejs';
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
    const frameMat = new cv.Mat(
      Buffer.from(frameData),
      height,
      width,
      cv.CV_8UC3
    )

    this.sprites.forEach((spriteMat) => {
      const sprites: Sprite[] = []
      const matches = frameMat
        .matchTemplate(spriteMat, cv.TM_SQDIFF_NORMED)


      const threshold = 0.9
      const loc = this.extractLocation(matches, threshold)

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
        matches: Uint8ClampedArray.from(
          matches
            .mul(255)
            .convertTo(cv.CV_8UC3)
            .getData()),
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