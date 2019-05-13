import * as fs from 'fs';
import * as path from 'path';
const rimraf = require('rimraf');

// const VideoLib = require('node-video-lib');
const ffmpeg = require('ffmpeg');
// const FfmpegCommand = require('fluent-ffmpeg');
// const extractFrames = require('ffmpeg-extract-frames');
// const fileUrl = require('file-url');
// const videoFrameExtractor = require('video-frame-extractor');

// extract 3 frames at 1s, 2s, and 3.5s respectively

// var p = Decoder({});
// p.onPictureDecoded = () => {

// };


const mapsDir = path.resolve("./maps");
const imagePaths = fs.readdirSync(mapsDir);

const videoDir = path.resolve("./vids");
const videoFiles = fs.readdirSync(videoDir);

const framesDir = path.resolve('./frames');

const rimRafAsPromised = (filePath): Promise<void> =>
  new Promise((resolve, reject) => {
    console.log('Deleting:', filePath);
    rimraf(filePath, {}, () => {
      console.log('Deleting:', filePath, 'done');
      resolve()
    });
  });


const normalizeFileName = (filename: string) => {
  return filename
    .replace(' ', '_');
}

const fixStringLength = (input: string, length: number, filler: string, append: boolean = false): string => {
  let extension =
    new Array(Math.min(length, length - input.length))
      .fill(filler)
      .join("");

  let result = append ?
    input + extension :
    extension + input;
  return result;


};



videoFiles.forEach(async (videoFile) => {
  const videoPath = path.resolve(videoDir, videoFile);
  if (!fs.lstatSync(videoPath).isFile())
    return;

  videoFile = normalizeFileName(videoFile);
  const targetDir = path.resolve(videoDir, videoFile + '_frames');

  rimRafAsPromised(targetDir)
    .then(() => {


      if (!fs.existsSync(targetDir))
        fs.mkdirSync(targetDir);

      try {
        var process = new ffmpeg(videoPath);
        process.then((video: any) => {
          const duration = video.metadata.duration.seconds;
          const frameRate = video.metadata.video.fps;
          const totalFrames = duration * frameRate;

          console.log(totalFrames);

          // // Callback mode

          // for (let i = 0; i < totalFrames; i++) {
          video.addCommand('-hide_banner');
          // video.addCommand('-r 1');
          // video.addCommand('-t 1');
          // video.addCommand('-vframes 1');
          video.addCommand('-y');
          video.save(
            path.resolve(
              targetDir,
              'f_%08d.bmp'));


          // video.addCommand('-t 1');
          // ffmpeg -ss 0.5 -i inputfile.mp4 -t 1 -s 480x300 -f image2 imagefile.jpg



          // video.fnExtractFrameToJPG(targetDir, {
          //   frame_rate: 1,
          //   // number: 1,
          //   file_name: 'f_%8d',
          // },
          //   function (error, files) {
          //     // if (!error)
          //     // console.log('Frames: ' + files);
          //   }
          // );
        },
          (err: any) => {
            console.log('Error: ' + err);
          });
      } catch (e) {
        console.log(e.code);
        console.log(e.msg);
      }
      // videoFrameExtractor
      //     .extractFrame(videoPath, 100, 1, path.resolve(targetDir, '%D.bmp'));
    })
    .catch((error) => console.error(error))
});

// console.log(imagePaths);