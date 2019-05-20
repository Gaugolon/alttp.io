import child_process, { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
const d = require('debug')('ALTTP.IO.videoSource')
const {
  Worker
} = require('worker_threads')

const DefaultVideoSourceConfig: VideoSourceOptions = {
  width: 258,
  height: 224,
  colors: 3,
  start: 0
}

export default class VideoSource extends EventEmitter {
  private subprocess: ChildProcess
  private buffer: Uint8ClampedArray
  private bufferOffset: number = 0
  private byteSize: number
  public currentFrame: Uint8ClampedArray
  private _currentFrameCount: number = 0
  private started: boolean = false
  private worker: Worker
  constructor(private config: VideoSourceOptions) {
    super()
    if (config)
      this.config = Object.assign(DefaultVideoSourceConfig, config)

    d(this.config)

    if (!fs.existsSync(config.filePath))
      throw 'File not found'

    this.byteSize = this.config.width * this.config.height * this.config.colors
    this.buffer = new Uint8ClampedArray(this.byteSize)
    this.currentFrame = new Uint8ClampedArray(this.byteSize)
    d('spawning worker')
    // this.worker = new Worker('./src/videoSourceWorker.js', {})
    // this.worker.onmessage = (message: MessageEvent) => {
    //   console.log(message)
    // }
    // this.worker.onerror = (message: ErrorEvent) => {
    //   console.error(message)
    // }

  }

  get width() {
    return this.config.width
  }

  get height() {
    return this.config.height
  }

  get currentFrameCount() {
    return this._currentFrameCount
  }

  public start() {
    // return
    if (this.started)
      return
    this.started = true

    this.subprocess = child_process.spawn('ffmpeg', [
      "-ss", `${this.config.start}`,
      "-i", this.config.filePath,
      "-an",
      "-hide_banner",
      "-vf", `scale=w=${this.config.width}:h=${this.config.height}`,
      "-pix_fmt", "rgb24",
      "-c:v", "rawvideo",
      "-f", "rawvideo",
      "-"
    ])
    this.subprocess.stdout.on('data', (data) => this.processData(data))
    this.subprocess.stderr.on('data', (data) => d(data.toString()))
    this.subprocess.addListener('exit', () => this.emit('end'))
  }

  private processData(data: Buffer) {
    for (let i = 0; i < data.length; i++) {
      this.buffer[this.bufferOffset] = data.readUInt8(i)
      this.bufferOffset = (this.bufferOffset + 1) % this.byteSize
      if (this.bufferOffset == 0) {
        this.currentFrame = Uint8ClampedArray.from(this.buffer)
        this.emit('frame')
        this._currentFrameCount++
      }
    }
  }

  public pause = () => this.subprocess.stdout.pause()
  public resume = () => this.subprocess.stdout.resume()
}

export interface VideoSourceOptions {
  start?: number
  filePath?: string
  width?: number
  height?: number
  colors?: number
}