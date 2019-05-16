import * as fs from 'fs';
import * as path from 'path';
import child_process, { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export default class VideoSource extends EventEmitter {
  private subprocess: ChildProcess;
  private buffer: Uint8ClampedArray;
  private bufferOffset: number = 0;
  private byteSize: number;
  public currentFrame: Uint8ClampedArray;
  private started: boolean = false;
  constructor(
    private filePath: string,
    readonly width: number = 288,
    readonly height: number = 224,
    readonly colors: number = 3,
  ) {
    super();

    if (!fs.existsSync(filePath))
      throw 'File not found';

    this.byteSize = this.width * this.height * this.colors;
    this.buffer = new Uint8ClampedArray(this.byteSize);
    this.currentFrame = new Uint8ClampedArray(
      this.width * this.height * this.colors
    );
  }

  public start() {
    if (this.started)
      return;
    this.started = true;

    this.subprocess = child_process.spawn('ffmpeg', [
      "-ss", "2000",
      "-i", this.filePath,
      "-an",
      "-hide_banner",
      "-vf", "scale=w=288:h=224",
      "-pix_fmt", "rgb24",
      "-c:v", "rawvideo",
      "-f", "rawvideo",
      "-"
    ]);
    this.subprocess.stdout.on('data', (data) => this.processData(data));
    this.subprocess.addListener('exit', () => this.emit('end'));
  }

  private processData(data: Buffer) {
    // this.subprocess.stdout.pause();
    console.log("processData");

    for (let i = 0; i < data.length; i++) {
      this.buffer[this.bufferOffset] = data.readUInt8(i);
      this.bufferOffset = (this.bufferOffset + 1) % this.byteSize;
      if (this.bufferOffset == 0) {
        this.currentFrame = Uint8ClampedArray.from(this.buffer);
        this.emit('frame');
      }
    }

    // console.log(data.subarray(0, 12));
    // const chunks = Math.floor(data.length / this.byteSize);
    // console.log({
    //   "buf.length": buf.length,
    //   "buf.byteLength": buf.byteLength,
    //   "this.byteSize": this.byteSize,
    //   "buf.byteOffset": buf.byteOffset,
    //   chunks
    // });

    // let cursor = 0;
    // while (cursor < data.length) {
    //   this.buffer[this.cursorPosition + cursor] = data.readUInt8(cursor);
    //   cursor++;
    //   this.cursorPosition = (this.cursorPosition + 1) % this.byteSize;
    // }


    // this.subprocess.stdout.resume();

  }

  public pause = () => this.subprocess.stdout.pause();
  public resume = () => this.subprocess.stdout.resume();
}

// const rimRafAsPromised = (filePath: string): Promise<void> =>
//   new Promise((resolve, reject) => {
//     console.log('Deleting:', filePath);
//     rimraf(filePath, {}, () => {
//       console.log('Deleting:', filePath, 'done');
//       resolve();
//     });
//   });


// const normalizeFileName = (filename: string): string => {
//   return filename
//     .replace(' ', '_');
// };

// const fixStringLength = (input: string, length: number, filler: string, append: boolean = false): string => {
//   let extension =
//     new Array(Math.min(length, length - input.length))
//       .fill(filler)
//       .join("");

//   let result = append ?
//     input + extension :
//     extension + input;
//   return result;
// };

// const readVideoFile = (filePath: string): Promise<void> => {
//   return new Promise((resolve, reject) => {



//     if (!fs.lstatSync(filePath).isFile())
//       return;

//     filePath = normalizeFileName(filePath).replace('\\', '/');
//     console.log(filePath);

//     let size = 0;


//     // const process = child_process.spawnSync('ffmpeg', [
//     //   "-i", filePath,
//     //   // "-c:a", "copy",
//     //   "-an",
//     //   "-hide_banner",
//     //   "-c:v", "rawvideo",
//     //   "-f", "rawvideo",
//     //   "-"
//     // ], { stdio: ['ignore', 'pipe', 2] });
//     const process = child_process.spawn('ffmpeg', [
//       "-i", filePath,
//       // "-c:a", "copy",
//       "-an",
//       "-hide_banner",
//       "-c:v", "rawvideo",
//       "-f", "rawvideo",
//       "-"
//     ]);

//     process.stdout.on('data', (data) => {
//       size += Uint8ClampedArray.from(Buffer.from(data)).length;
//     });

//     process.on('close', () => {
//       console.log(size);
//     });

//     // .stdout.on('data', function (data) {
//     //   size += Uint8ClampedArray.from(Buffer.from(data)).length;
//     // }).on('close', () => {
//     //   console.log(size);
//     // });

//     // const child = require('child_process').execFile('echo', ['123']);
//     const b = Buffer.alloc(620 * 252 * 3);
//     let offset = 0;

//     // ffmpeg({
//     //   mounts: [{
//     //     type: "NODEFS",
//     //     opts: {
//     //       root: "./vids"
//     //     },
//     //     mountpoint: "/data"
//     //   }],
//     //   arguments: [
//     //     "-i", "/data/" + path.basename(filePath),
//     //     "-c:v", "libx264",
//     //     "-c:a", "mp3",
//     //     "-an",
//     //     "-hide_banner",
//     //     "-f", "mp4",
//     //     "-"
//     //   ],
//     //   printErr: (data: string) => { stderr += data + "\n"; },
//     //   onExit: (code: string) => {
//     //     console.log("Process exited with code " + code);
//     //     console.log(stdout);
//     //     console.log(stderr);
//     //     resolve();
//     //   },
//     //   // stdin: function () { },
//     //   stdout: function (data: string) {
//     //     console.log(data);
//     //   },
//     // });
//   });

// };


// const mapsDir = path.resolve("./maps");
// const imagePaths = fs.readdirSync(mapsDir);

// const videoDir = path.resolve("./vids");
// // const videoFiles = fs.readdirSync(videoDir);
// const videoFiles = ['620x252_3DModels.mp4'];

// const framesDir = path.resolve('./frames');

// const commandChain = Promise.resolve();

// videoFiles.forEach((filePath) =>
//   commandChain.then(() => readVideoFile(path.resolve(videoDir, filePath))));

// commandChain.catch((error) => console.error(error));
