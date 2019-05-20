import * as fs from 'fs'
import * as cv from 'opencv4nodejs'
import * as path from 'path'
const debug = require('debug');
const d = debug('SpriteLocator')

function readSprite(filename): SpriteData {
  return JSON.parse(fs.readFileSync(filename).toString())
}

export default class SpriteLocator {
  private sprites: {
    img: cv.Mat,
    threshold?: number,
    // mask: cv.Mat
  }[] = []
  constructor(private spritesDirectory: string) {
    d('construct')
    const maskRegex = /(.*)\.sprite.json/
    const files = fs.readdirSync(spritesDirectory)
      .filter((filename) => maskRegex.exec(filename) !== null)
      .map((filename) => path.resolve(this.spritesDirectory, filename))
      .forEach((file) => {
        d(file)
        const fullPath = path.resolve(this.spritesDirectory, file)
        const imgData = readSprite(fullPath)
        const spriteMat = new cv.Mat(
          Buffer.from(imgData.imgData, 'base64'),
          imgData.height,
          imgData.width,
          cv.CV_8UC3
        )

        // const maskMat = new cv.Mat(
        //   Buffer.from(imgData.maskData, 'base64'),
        //   imgData.height,
        //   imgData.width,
        //   cv.CV_8UC3
        // ).cvtColor(cv.COLOR_RGB2GRAY).convertTo(cv.CV_8U)

        // const spriteMat = cv
        //   .imread(fullPath)
        //   .cvtColor(cv.COLOR_BGR2RGB)
        // .blur(new cv.Size(2, 2))

        this.sprites.push({
          threshold: imgData.threshold,
          img: spriteMat,
          // mask: maskMat
        })
        d(this.sprites)
      })
  }

  private isNeigbor = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    height: number
  ): boolean => {
    if (x1 >= x2 && y1 >= y2)
      return false
    if (x2 - x1 < width && y2 - y1 < height)
      return true
    return false
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
        .matchTemplate(spriteMat.img, cv.TM_SQDIFF_NORMED)


      const threshold = spriteMat.threshold ? spriteMat.threshold : 30

      let loc = this.extractLocation(matches, threshold)

      // d(loc.length)

      loc = loc.reverse()
        .filter((loc1) => loc
          .filter((loc2) => this.isNeigbor(
            loc2.x,
            loc2.y,
            loc1.x,
            loc1.y,
            spriteMat.img.cols / 2,
            spriteMat.img.rows / 2
          ))
          .length === 0)


      // d(loc.length)

      // process.exit(0)

      loc
        .forEach((location) => {
          sprites.push({
            x: location.x,
            y: location.y,
            w: spriteMat.img.cols,
            h: spriteMat.img.rows,
            spriteName: "unknown",
          })
        })

      result.push({
        sprites,
        item: Uint8ClampedArray.from(
          spriteMat.img
            .getData()
        ),
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


    const cvtDataMat = mat
      .mul(255)
      .convertTo(cv.CV_8UC1)
    const matData = cvtDataMat.getData()
    for (let i = 0; i < matData.length; i++) {
      const data = matData[i]
      if (data < threshold) {
        const pos = {
          x: i % cvtDataMat.cols,
          y: Math.floor(i / cvtDataMat.cols)
        }
        result.push(pos)
      }
    }
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

interface SpriteData {
  width: number
  height: number
  imgData: string
  maskData: string
  threshold?: number
}

export interface LocatorResult {
  sprites: Sprite[]
  item: Uint8ClampedArray
  matches: Uint8ClampedArray
  matchesMat: cv.Mat
}