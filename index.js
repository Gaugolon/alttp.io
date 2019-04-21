"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path = tslib_1.__importStar(require("path"));
const xnesRunner_1 = tslib_1.__importDefault(require("./xnesRunner"));
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
const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
const frameOut = document.getElementById('currentFrame');
const render = (data) => {
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
const xnes = new xnesRunner_1.default(filePath);
xnes.on('frame', (e) => {
    render(e.data);
    frameOut.innerText = e.frame.toString();
});
const tapButton = (button) => {
    console.log(`TAP ${button}`);
    return holdButton(button, 1);
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
const holdButton = (button, frames) => {
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
        };
        xnes.addListener("frame", listener);
    });
};
const wait = (frame) => {
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
const waitUntil = (frame) => {
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
const startGame = () => {
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
const skipStartSequence = () => {
    return spamButton(Button.X, 40000);
};
const leaveHouse = () => {
    return Promise.resolve()
        .then(() => waitUntil(2600))
        .then(() => holdButton(Button.RIGHT, 300))
        .catch(console.error);
};
startControls();
//# sourceMappingURL=index.js.map