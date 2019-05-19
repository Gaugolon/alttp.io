import child_process, { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'

export default class VideoSource extends EventEmitter {
  private subprocess: ChildProcess
  private buffer: Uint8ClampedArray
  private bufferOffset: number = 0
  private byteSize: number
  public currentFrame: Uint8ClampedArray
  private started: boolean = false
  constructor(
    private filePath: string,
    readonly width: number = 258,
    readonly height: number = 224,
    readonly colors: number = 3,
  ) {
    super()

    if (!fs.existsSync(filePath))
      throw 'File not found'

    this.byteSize = this.width * this.height * this.colors
    this.buffer = new Uint8ClampedArray(this.byteSize)
    this.currentFrame = new Uint8ClampedArray(this.byteSize)
  }

  public start() {
    if (this.started)
      return
    this.started = true

    this.subprocess = child_process.spawn('ffmpeg', [
      "-ss", "1300",
      "-i", this.filePath,
      "-an",
      "-hide_banner",
      "-vf", "scale=w=258:h=224",
      "-pix_fmt", "rgb24",
      "-c:v", "rawvideo",
      "-f", "rawvideo",
      "-"
    ])
    this.subprocess.stdout.on('data', (data) => this.processData(data))
    this.subprocess.addListener('exit', () => this.emit('end'))
  }

  private processData(data: Buffer) {
    for (let i = 0; i < data.length; i++) {
      this.buffer[this.bufferOffset] = data.readUInt8(i)
      this.bufferOffset = (this.bufferOffset + 1) % this.byteSize
      if (this.bufferOffset == 0) {
        this.currentFrame = Uint8ClampedArray.from(this.buffer)
        this.emit('frame')
      }
    }
  }

  public pause = () => this.subprocess.stdout.pause()
  public resume = () => this.subprocess.stdout.resume()
}