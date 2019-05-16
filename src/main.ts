import bodyParser from 'body-parser';
import express from 'express';
import VideoSource from './video-source';
import * as fs from 'fs';
import * as path from 'path';
import * as cv from 'opencv4nodejs';
const cors = require('cors');

const videoFile = './src/public/vids/SNES_Longplay_[315]_The_Legend_of_Zelda_-_A_Link_to_the_Past_(a)-Z6hjG6MCcZ8.mp4';

const app = express();

const vs = new VideoSource(videoFile);

let currentFrame: number[] = [];
let currentPos = { x: 0, y: 0 };
let currentMap: Buffer = Buffer.alloc(288 * 224 * 3);

const frame2Mat = (data: Uint8ClampedArray, w: number, h: number, c: number): cv.Mat => {
    return new cv.Mat(Buffer.from(data), w, h, cv.CV_8UC3);
};
vs.on('frame', () => {
    vs.pause();
    console.log(vs.currentFrame.length);
    const frameMat = frame2Mat(vs.currentFrame, vs.width, vs.height, vs.colors);
    find(frameMat);
    vs.resume();
});


app.use(cors());
app.use(bodyParser.json());
app.get('/frame', (req, res, next) => {
    res.json({
        frame: Array.from(vs.currentFrame),
        pos: Object.assign(currentPos, { w: 288 / 4, h: 224 / 4 }),
        // map: Array.from(currentMap),
        // matches: matchedMask,
    });
});

app.use('/', express.static('./src'));
app.listen(8081);

const kernelSize = 15;
const cvKernelSize = new cv.Size(kernelSize, kernelSize);

let mapMat: cv.Mat;
let frameMask: cv.Mat;
let matchedMask: Buffer;


const find = (frame: cv.Mat): Location | boolean => {
    // Load images
    if (!mapMat) {
        const fPath = path.resolve('./maps/light_world-2.jpg');
        mapMat = cv.imread(fPath)
            // .cvtColor(cv.COLOR_BGR2GRAY);
            .cvtColor(cv.COLOR_BGR2RGB);

    }
    if (!frameMask) {
        const fPath = path.resolve('./maps/mask.jpg');
        frameMask = cv.imread(fPath)
            // .cvtColor(cv.COLOR_BGR2GRAY)
            .cvtColor(cv.COLOR_BGR2RGB)
            .rotate(cv.ROTATE_90_COUNTERCLOCKWISE);
    }

    // console.log({
    //     frame, frameMask, mapMat
    // });


    let originalMat: cv.Mat = mapMat.copy();
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
    // console.log(matchesModes);

    const scale = 1 / 32;


    const matched = originalMat
        .rescale(scale)
        .cvtColor(cv.COLOR_BGR2GRAY)
        .matchTemplate(
            frame
                .rescale(scale)
                .cvtColor(cv.COLOR_BGR2GRAY),
            4
        );

    matchedMask = matched.getData();

    // Use minMaxLoc to locate the highest value (or lower, depending of the type of matching method)
    const minMax = matched.minMaxLoc();
    const { maxLoc: { x, y } } = minMax;
    currentPos = { x: x / scale, y: y / scale };
    console.log(currentPos);

    // Draw bounding rectangle
    originalMat = originalMat.rescale(1 / 4);
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
    );

    currentMap = originalMat.getData();

    // Open result in new window
    // cv.imshow('We\'ve found Waldo!', originalMat);
    // cv.waitKey();
    // return await originalMat.getData();
    if (x !== 0 && y !== 0)
        return { x, y };

    return false;
};


interface Location {
    x: number;
    y: number;
}

vs.start();
