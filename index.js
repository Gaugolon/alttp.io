"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
const events_1 = require("events");
const workerPath = path.resolve('ww.js');
const filePath = path.resolve('./roms/alttp.sfc');
const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
let currentFrame = 0;
const fileContent = fs.readFileSync(filePath);
const callbacks = {
    'print': (data) => console.log(data.txt),
    'render': (data) => render(data.src),
};
const frameOut = document.getElementById('currentFrame');
const listeners = [];
const render = (data) => {
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
            out = false;
        }
    }
    for (let listener of listeners) {
    }
    context.putImageData(imgData, 0, 0);
    frameOut.innerText = currentFrame.toString();
};
const wait = (delay) => {
    console.log(`WAITING FOR ${delay} MILLISECONDS`);
    return new Promise((resolve, reject) => {
        setTimeout(resolve, delay);
    });
};
const tapButton = (button) => {
    console.log(`TAP ${button}`);
    return holdButton(button, 150);
};
const holdButton = (button, duration) => {
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
const spamButton = (button, duration) => {
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
const startGame = () => {
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
const skipStartSequence = () => {
    return spamButton(Button.X, 40000);
};
var Button;
(function (Button) {
    Button[Button["NONE"] = 0] = "NONE";
    Button[Button["UP"] = 9] = "UP";
    Button[Button["DOWN"] = 8] = "DOWN";
    Button[Button["LEFT"] = 7] = "LEFT";
    Button[Button["RIGHT"] = 6] = "RIGHT";
    Button[Button["A"] = 2] = "A";
    Button[Button["B"] = 3] = "B";
    Button[Button["Y"] = 4] = "Y";
    Button[Button["X"] = 5] = "X";
    Button[Button["START"] = 10] = "START";
    Button[Button["SELECT"] = 0] = "SELECT";
    Button[Button["L"] = 0] = "L";
    Button[Button["R"] = 0] = "R";
})(Button || (Button = {}));
class XNesRunner extends events_1.EventEmitter {
    constructor(rom) {
        super();
        this.worker = new Worker(workerPath);
        this.worker.onerror = (e) => console.error(e);
        this.worker.onmessage = (e) => {
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
    onFrame(frame) {
        this.emit('frame', { frame });
    }
}
//# sourceMappingURL=index.js.map