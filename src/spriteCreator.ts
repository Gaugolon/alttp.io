import * as fs from 'fs'
import * as path from 'path'
import { PNG } from 'pngjs'
const md5 = require('md5')
const rimraf = require('rimraf')
const parseArgs = require('minimist')
const jpeg = require('jpeg-js');

const opts = cleanArgs(parseArgs(process.argv))

console.log(opts)

switch (opts.mode) {
  case 'cvtmaps':
    convertMaps()
    break
  case 'cvtsprites':
    convertSprites()
    break
  default:
    exitWithError(`Mode ${opts.mode} is invalid`)
}

function cleanArgs(options: any): any {
  if (!options.mode && !options.m)
    exitWithError('Missing --mode or -m paramter')
  if (!options.in && !options.i)
    exitWithError('Missing --in or -i paramter')
  if (!options.out && !options.o)
    exitWithError('Missing --out or -o paramter')
  options.mode = options.m !== undefined ? options.m : options.mode
  options.in = options.i !== undefined ? options.i : options.in
  options.out = options.o !== undefined ? options.o : options.out
  return options
}

function exitWithError(error: string) {
  process.stderr.write(error)
  process.exit(1)
}

function convertMaps() {

  const mapsPath = path.resolve(opts.in)
  const outputPath = path.resolve(opts.out)

  if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath)

  fs.readdirSync(mapsPath)
    .forEach((filename, i) => {

      // console.log(filename)

      const filepath = path.resolve(mapsPath, filename)
      // const png = new PNG.sync()
      const imageData = PNG.sync.read(fs.readFileSync(filepath))

      for (let sx = 0; sx < imageData.width / 16; sx++) {
        for (let sy = 0; sy < imageData.height / 16; sy++) {
          const outPutData = new PNG({
            width: 16,
            height: 16,
            colorType: 4,
            // inputColorType: 4,
            bitDepth: 8
          })
          for (let dx = 0; dx < 16; dx++) {
            for (let dy = 0; dy < 16; dy++) {
              const si = ((sy * 16) + dy) * imageData.width + ((sx * 16) + dx)
              const di = dy * 16 + dx
              outPutData.data[di * 4 + 0] = imageData.data[si * 4 + 0]
              outPutData.data[di * 4 + 1] = imageData.data[si * 4 + 1]
              outPutData.data[di * 4 + 2] = imageData.data[si * 4 + 2]
              outPutData.data[di * 4 + 3] = imageData.data[si * 4 + 3]
            }
          }
          // const outFilename = sx + '_' + sy + '_' + filename
          const outFilename = md5(outPutData.data) + '.png'
          const outFile = path.resolve(outputPath, outFilename)
          if (fs.existsSync(outFile))
            return
          // console.log(outFilename)
          // console.log(outPutData.data)
          fs.writeFileSync(outFile, PNG.sync.write(outPutData))
        }
      }
    })

}

function stripeAlpha(data: Uint8Array): Uint8Array {
  // console.log(Buffer.from(data))
  const result = new Uint8Array(data.length * (3 / 4))
  for (let i = 0; i < data.length; i++) {
    if (i % 4 === 3)
      continue
    const baseI = Math.floor(i / 4)
    result[baseI * 3 + 0] = data[baseI * 4 + 0]
    result[baseI * 3 + 1] = data[baseI * 4 + 1]
    result[baseI * 3 + 2] = data[baseI * 4 + 2]
  }
  // console.log(Buffer.from(result))
  return result
}

function convertSprites() {
  const spritesPath = path.resolve(opts.in)
  const outputPath = path.resolve(opts.out)

  const maskRegex = /.*\.(mask).jpg/

  if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath)

  const filePaths = fs.readdirSync(spritesPath)
    .filter((filename) => maskRegex.exec(filename) === null)
    .filter((filename) => path.extname(filename) == '.jpg')
    .map((filename) => ({
      imgPath: path.resolve(spritesPath, filename),
      jsonPath: path.resolve(spritesPath, path.basename(filename, '.jpg') + '.json'),
      outPath: path.resolve(outputPath, path.basename(filename, '.jpg') + '.sprite.json')
    }))

  filePaths.forEach((filepath, i) => {
    console.log(filepath)
    let additions = {}
    if (fs.existsSync(filepath.jsonPath)) {
      additions = JSON.parse(fs.readFileSync(filepath.jsonPath).toString())
    }

    const imgData = jpeg.decode(fs.readFileSync(filepath.imgPath), true)
    // const maskData = jpeg.decode(fs.readFileSync(filepath.maskPath), true)
    // if (!(imgData.width === maskData.width) || !(imgData.height === maskData.height)) {
    //   console.log(`${filepath.imgPath} and ${filepath.maskPath} don't have the same dimensions`)
    //   return
    // }
    const { width, height } = imgData
    // console.log("imgData", imgData.data.length)
    // console.log("maskData", stripeAlpha(maskData.data))

    const content = {
      width,
      height,
      imgData: Buffer.from(stripeAlpha(imgData.data)).toString('base64'),
      // maskData: Buffer.from(stripeAlpha(maskData.data)).toString('base64'),
    }

    const addedContent = Object.assign(content, additions)
    console.log(additions)

    fs.writeFileSync(filepath.outPath, JSON.stringify(addedContent))
  })

}