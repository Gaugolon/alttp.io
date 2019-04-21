import * as fs from 'fs';
// import { Worker } from 'worker_threads';
import * as path from 'path';
import { resolve } from 'url';
import { once } from 'cluster';
import { EventEmitter } from 'events';
import XNesRunner, { XnesRunnerFrameEvent } from './xnesRunner';

enum Button {
    "NONE" = 0,
    "UP" = 9,
    "DOWN" = 8,
    "LEFT" = 7,
    "RIGHT" = 6,
    "A" = 2,
    "B" = 3,
    "Y" = 4,
    "X" = 5,
    "START" = 10,
    "SELECT" = 0,
    "L" = 0,
    "R" = 0
}

const canvas: HTMLCanvasElement =
    document.getElementById('screen') as HTMLCanvasElement;
const context = canvas.getContext('2d');
const imgData = context.getImageData(0, 0, canvas.width, canvas.height);

const frameOut: HTMLParagraphElement =
    document.getElementById('currentFrame') as HTMLParagraphElement;

const render = (data: Int32Array) => {
    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        imgData.data[i * 4 + 0] = Math.abs((val & 0x0000FF) >> 0);
        imgData.data[i * 4 + 1] = Math.abs((val & 0x00FF00) >> 8);
        imgData.data[i * 4 + 2] = Math.abs((val & 0xFF0000) >> 16);
        imgData.data[i * 4 + 3] = 255;
    }
    context.putImageData(imgData, 0, 0);
};

const filePath = path.resolve('./roms/alttp.sfc');
const xnes = new XNesRunner(filePath);


xnes.on('frame', (e: XnesRunnerFrameEvent) => {
    render(e.data);
    frameOut.innerText = e.frame.toString();
});


// const wait = (delay: number): Promise<void> => {
//     console.log(`WAITING FOR ${delay} MILLISECONDS`);
//     return new Promise((resolve, reject) => {
//         setTimeout(resolve, delay);
//     });
// };

const tapButton = (button: Button): Promise<void> => {
    console.log(`TAP ${button}`);
    return holdButton(button, 1);
};

const spamButton = (button: Button, duration: number): Promise<void> => {
    console.log(`SPAMMING ${button} FOR ${duration} MILLISECONDS`);
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => tapButton(button), 300);
        setTimeout(() => {
            clearInterval(interval);
            resolve();
        }, duration);
    });
};

const holdButton = (button: Button, frames: number): Promise<void> => {
    console.log(`HOLDING BUTTON ${button} FOR ${frames} FRAMES`);
    return new Promise((resolve, reject) => {
        let f = 0;
        const state = (2 ** button) << 2;
        xnes.sendControl(state);
        const listener = () => {
            if (f >= frames) {
                console.log(`RELEASING BUTTON ${button} AFTER ${f} FRAMES`);
                xnes.sendControl(0);
                xnes.removeListener("frame", listener);
                resolve();
            }
            f++;
        }
        xnes.addListener("frame", listener);
    });

}

const wait = (frame: number): Promise<void> => {
    console.log(`WAITING FOR ${frame} FRAMES`);
    return new Promise((resolve, reject) => {
        let frames = 0;
        xnes.on("frame", () => {
            if (frames >= frame)
                resolve();
            frames++;
        });
    });
};

const waitUntil = (frame: number): Promise<void> => {
    console.log(`WAITING UNTIL FRAME ${frame}`);
    return new Promise((resolve, reject) => {
        xnes.on("frame", (e) => {
            if (e.frame >= frame)
                resolve();
        });
    });
};

const frameMarker = {
    startFrame: 300,
    menuTransitionFrames: 3,
    writeCursorsSettleFrames: 2,
    selectGameFrames: 100,
};

const startControls = () => {
    Promise.resolve()
        .then(() => startGame())
        .then(() => skipStartSequence())
        .then(() => leaveHouse())
        .then(() => console.log('DONE'))
        .catch(console.error);
};

const startGame = (): Promise<void> => {
    return Promise.resolve()
        .then(() => waitUntil(frameMarker.startFrame))
        .then(() => tapButton(Button.START))
        .then(() => wait(frameMarker.selectGameFrames))
        .then(() => tapButton(Button.START))
        .then(() => wait(frameMarker.menuTransitionFrames))
        .then(() => holdButton(Button.LEFT, 18))
        .then(() => holdButton(Button.DOWN, 6))
        .then(() => wait(frameMarker.writeCursorsSettleFrames))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.LEFT, 18))
        .then(() => wait(frameMarker.writeCursorsSettleFrames))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.RIGHT, 26))
        .then(() => wait(frameMarker.writeCursorsSettleFrames))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.LEFT, 17))
        .then(() => wait(frameMarker.writeCursorsSettleFrames))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.LEFT, 15))
        .then(() => wait(frameMarker.writeCursorsSettleFrames))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.RIGHT, 30))
        .then(() => wait(frameMarker.writeCursorsSettleFrames))
        .then(() => tapButton(Button.X))
        .then(() => tapButton(Button.START))
        .then(() => wait(frameMarker.writeCursorsSettleFrames))
        .then(() => tapButton(Button.START))
        .then(() => wait(frameMarker.menuTransitionFrames))
        .catch((error) => console.log(error));
};

const skipStartSequence = (): Promise<void> => {
    return spamButton(Button.X, 40000);
};

const leaveHouse = (): Promise<void> => {
    return Promise.resolve()
        .then(() => waitUntil(2600))
        .then(() => holdButton(Button.RIGHT, 300))
        // .then(() => holdButton(Button.LEFT, 400))
        // .then(() => holdButton(Button.UP, 400))
        // .then(() => holdButton(Button.DOWN, 400))
        .catch(console.error);
};

startControls();
