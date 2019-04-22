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
var Mode;
(function (Mode) {
    Mode[Mode["VANILLA"] = 0] = "VANILLA";
    Mode[Mode["RANDOMIZED"] = 1] = "RANDOMIZED";
})(Mode || (Mode = {}));
var CCode;
(function (CCode) {
    CCode["DE"] = "09";
    CCode["JP"] = "00";
})(CCode || (CCode = {}));
const canvas = document.getElementById('screen');
console.log({ canvas });
const frameOut = document.getElementById('currentFrame');
const filePath = path.resolve('./roms/alttp.smc');
const xnes = new xnesRunner_1.default(filePath, canvas);
let currentFrame = 0;
xnes.on('frame', (e) => {
    currentFrame = e.frame;
    frameOut.innerText = e.frame.toString();
});
const tapButton = (button) => {
    console.log(`TAP ${button}`);
    return holdButton(button, 1);
};
const spamButton = (button, frames) => {
    return new Promise((resolve, reject) => {
        let f = 0;
        const listener = () => {
            if (f >= frames) {
                xnes.removeListener("frame", listener);
                resolve();
            }
            if (f % 4 == 0) {
                tapButton(button);
            }
            else {
                xnes.sendControl(0);
            }
            f++;
        };
        xnes.addListener("frame", listener);
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
    return new Promise((resolve, reject) => {
        let frames = 0;
        const listener = () => {
            if (frames >= frame) {
                xnes.removeListener("frame", listener);
                resolve();
            }
            frames++;
        };
        xnes.addListener("frame", listener);
    });
};
const waitUntil = (frame) => {
    return new Promise((resolve, reject) => {
        const listener = (e) => {
            if (e.frame >= frame) {
                xnes.removeListener("frame", listener);
                resolve();
            }
        };
        xnes.addListener("frame", listener);
    });
};
const mode = Mode.VANILLA;
const countryCode = CCode.JP;
const getStartFrame = () => {
    switch (countryCode) {
        case CCode.DE:
            return 300;
        case CCode.JP:
            return 400;
    }
};
const getWriteCursorsSettleFrames = () => {
    switch (countryCode) {
        case CCode.DE:
            return 2;
        case CCode.JP:
            return 3;
    }
};
const frameMarker = {
    startFrame: getStartFrame(),
    menuTransitionFrames: 4,
    writeCursorsSettleFrames: getWriteCursorsSettleFrames(),
    selectGameFrames: 100,
};
const startControls = () => {
    Promise.resolve()
        .then(() => startGame())
        .then(() => console.log("startGame sequence finished at frame: ", currentFrame))
        .then(() => skipIntro())
        .then(() => console.log("skipIntro sequence finished at frame: ", currentFrame))
        .then(() => leaveHouse())
        .then(() => console.log("leaveHouse sequence finished at frame: ", currentFrame))
        .then(() => {
        xnes.stop();
        console.log('DONE');
    })
        .catch(console.error);
};
const startGame = () => {
    switch (countryCode) {
        case CCode.DE:
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
                .then(() => holdButton(Button.RIGHT, 18))
                .then(() => holdButton(Button.DOWN, 18))
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
                .then(() => wait(frameMarker.menuTransitionFrames))
                .then(() => tapButton(Button.START))
                .catch(console.error);
        case CCode.JP:
            return Promise.resolve()
                .then(() => waitUntil(frameMarker.startFrame))
                .then(() => tapButton(Button.START))
                .then(() => wait(frameMarker.selectGameFrames))
                .then(() => tapButton(Button.START))
                .then(() => wait(frameMarker.menuTransitionFrames))
                .then(() => holdButton(Button.LEFT, 20))
                .then(() => holdButton(Button.DOWN, 10))
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
                .then(() => wait(frameMarker.menuTransitionFrames))
                .then(() => tapButton(Button.START))
                .catch(console.error);
    }
};
const skipIntro = () => {
    switch (mode) {
        case Mode.RANDOMIZED:
            return Promise.resolve()
                .then(() => wait(100))
                .then(() => tapButton(Button.X))
                .then(() => wait(50));
        case Mode.VANILLA:
            return Promise.resolve()
                .then(() => spamButton(Button.X, 1880))
                .catch(console.log);
            break;
    }
};
const leaveHouse = () => {
    return Promise.resolve()
        .then(() => wait(100))
        .then(() => holdButton(Button.RIGHT, 18))
        .then(() => holdButton(Button.DOWN, 62))
        .then(() => holdButton(Button.RIGHT, 50))
        .then(() => tapButton(Button.UP))
        .then(() => tapButton(Button.X))
        .then(() => wait(100))
        .then(() => tapButton(Button.X))
        .then(() => wait(25))
        .then(() => tapButton(Button.X))
        .then(() => wait(25))
        .then(() => holdButton(Button.LEFT, 50))
        .then(() => holdButton(Button.DOWN, 50))
        .then(() => wait(200))
        .catch(console.error);
};
//# sourceMappingURL=index.js.map