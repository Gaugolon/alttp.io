import * as fs from 'fs';
// import { Worker } from 'worker_threads';
import * as path from 'path';
import { resolve } from 'url';
import { once } from 'cluster';
import { EventEmitter } from 'events';

const workerPath = path.resolve('ww.js');
const filePath = path.resolve('./roms/alttp.sfc');

const canvas: HTMLCanvasElement =
    document.getElementById('screen') as HTMLCanvasElement;
const context = canvas.getContext('2d');
const imgData = context.getImageData(0, 0, canvas.width, canvas.height);

let currentFrame: number = 0;

const fileContent = fs.readFileSync(filePath);
const callbacks = {
    'print': (data: XnesMessage) => console.log(data.txt),
    'render': (data: XnesMessage) => render(data.src),
};

const frameOut: HTMLParagraphElement =
    document.getElementById('currentFrame') as HTMLParagraphElement;

const listeners: XnesFrameEvent[] = [];

const render = (data: Int32Array) => {
    // console.log(data.length);
    // data = clean(data);
    if (currentFrame == 0)
        startControls();
    currentFrame++;
    let out = true;
    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        imgData.data[i * 4 + 0] = Math.abs((val & 0x0000FF) >> 0);
        imgData.data[i * 4 + 1] = Math.abs((val & 0x00FF00) >> 8);
        imgData.data[i * 4 + 2] = Math.abs((val & 0xFF0000) >> 16);
        imgData.data[i * 4 + 3] = 255;
        if (val != 0 && out) {
            // console.log(val.toString(2));
            out = false;
        }
    }
    for (let listener: XnesFrameEvent of listeners) {

    }
    context.putImageData(imgData, 0, 0);
    frameOut.innerText = currentFrame.toString();
};


const wait = (delay: number): Promise<void> => {
    console.log(`WAITING FOR ${delay} MILLISECONDS`);
    return new Promise((resolve, reject) => {
        setTimeout(resolve, delay);
    });
};

const tapButton = (button: Button): Promise<void> => {
    console.log(`TAP ${button}`);
    return holdButton(button, 150);
};

const holdButton = (button: Button, duration: number): Promise<void> => {
    console.log(`HOLD ${button} FOR ${duration} MILLISECONDS`);
    return new Promise((resolve, reject) => {
        const state = (2 ** button) << 2;
        worker.postMessage({ cmd: "joy1", state });
        setTimeout(() => {
            worker.postMessage({ cmd: "joy1", state: 0 });
            setTimeout(() => {
                resolve();
            }, 100);
        }, duration);
    });
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

const startControls = () => {
    Promise.resolve()
        .then(() => startGame())
        .then(() => skipStartSequence())
        .then(() => console.log('DONE'))
        .catch(console.error);
};

const startGame = (): Promise<void> => {
    return Promise.resolve()
        .then(() => wait(7000))
        .then(() => tapButton(Button.START))
        .then(() => wait(2000))
        .then(() => tapButton(Button.START))
        .then(() => wait(1200))
        .then(() => holdButton(Button.LEFT, 420))
        .then(() => holdButton(Button.DOWN, 150))
        .then(() => wait(200))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.LEFT, 400))
        .then(() => wait(200))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.RIGHT, 600))
        .then(() => wait(200))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.LEFT, 420))
        .then(() => wait(200))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.LEFT, 360))
        .then(() => wait(200))
        .then(() => tapButton(Button.X))
        .then(() => holdButton(Button.RIGHT, 700))
        .then(() => wait(200))
        .then(() => tapButton(Button.X))
        .then(() => tapButton(Button.START))
        .then(() => wait(200))
        .then(() => tapButton(Button.START))
        .then(() => wait(2000))
        .catch((error) => console.log(error));
};

const skipStartSequence = (): Promise<void> => {
    return spamButton(Button.X, 40000);
};


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

interface XnesMessage {
    cmd: string;
    src?: Int32Array;
    txt?: string;
}

interface XnesFrameEvent {
    frame: number;
}

class XNesRunner extends EventEmitter {
    worker: Worker;
    currentFrame: number;
    constructor(rom: string) {
        super();
        this.worker = new Worker(workerPath);
        this.worker.onerror = (e: Event) => console.error(e);
        this.worker.onmessage = (e: MessageEvent) => {
            switch (e.data.cmd) {
                case "print":
                    console.log(e.data.txt);
                    break;
                case "render":
                    this.currentFrame++;
                    this.onFrame(this.currentFrame);
            }
            callbacks[e.data.cmd](e.data);
        };

        this.worker.postMessage({ cmd: 'loadfile', buffer: fileContent });
        this.worker.postMessage({ cmd: 'start' });
    }

    onFrame(frame: number) {
        this.emit('frame', { frame });
    }
}