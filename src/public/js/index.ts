

const canvas: HTMLCanvasElement =
    document.getElementById('screen') as HTMLCanvasElement

const context = canvas.getContext('2d')

const imageData = context.getImageData(0, 0, 288, 224)

setInterval(() => {
    fetch('http://localhost:8081/frame')
        .then((data) => data.json())
        .then((data) => {
            console.log(data)
            for (let i in data) {
                imageData.data[i] = data[i]
            }
        })
        .catch((error) => console.error(error))
}, 1000)


// import * as fs from 'fs';
// // import { Worker } from 'worker_threads';
// import * as path from 'path';
// import { resolve } from 'url';
// import { once } from 'cluster';
// import { EventEmitter } from 'events';
// import XNesRunner, { XnesRunnerFrameEvent } from './xnesRunner';


// enum Button {
//     "NONE" = 0,
//     "UP" = 9,
//     "DOWN" = 8,
//     "LEFT" = 7,
//     "RIGHT" = 6,
//     "A" = 2,
//     "B" = 3,
//     "Y" = 4,
//     "X" = 5,
//     "START" = 10,
//     "SELECT" = 0,
//     "L" = 0,
//     "R" = 0
// }

// enum Mode {
//     "VANILLA" = 0,
//     "RANDOMIZED" = 1,
// }

// enum CCode {
//     "DE" = "09",
//     "JP" = "00"
// }

// const canvas: HTMLCanvasElement =
//     document.getElementById('screen') as HTMLCanvasElement;

// console.log({ canvas });

// // const context = canvas.getContext('2d');
// // const imgData = context.getImageData(0, 0, canvas.width, canvas.height);

// const frameOut: HTMLParagraphElement =
//     document.getElementById('currentFrame') as HTMLParagraphElement;

// // const render = (data: Int32Array) => {
// //     for (let i = 0; i < data.length; i++) {
// //         const val = data[i];
// //         imgData.data[i * 4 + 0] = Math.abs((val & 0x0000FF) >> 0);
// //         imgData.data[i * 4 + 1] = Math.abs((val & 0x00FF00) >> 8);
// //         imgData.data[i * 4 + 2] = Math.abs((val & 0xFF0000) >> 16);
// //         imgData.data[i * 4 + 3] = 255;
// //     }
// //     context.putImageData(imgData, 0, 0);
// // };

// const filePath = path.resolve('./roms/alttp.sfc');
// // const filePath = path.resolve('./roms/ALttP - VT_no-glitches-30_normal-open_randomized-ganon_key-sanity_g5yoJW6mvm.sfc');
// const xnes = new XNesRunner(filePath, canvas);

// let currentFrame = 0;
// xnes.on('frame', (e: XnesRunnerFrameEvent) => {
//     // render(e.data);
//     currentFrame = e.frame;
//     frameOut.innerText = e.frame.toString();
// });


// // const wait = (delay: number): Promise<void> => {
// //     console.log(`WAITING FOR ${delay} MILLISECONDS`);
// //     return new Promise((resolve, reject) => {
// //         setTimeout(resolve, delay);
// //     });
// // };

// const tapButton = (button: Button): Promise<void> => {
//     console.log(`TAP ${button}`);
//     return holdButton(button, 1);
// };

// const spamButton = (button: Button, frames: number): Promise<void> => {
//     // console.log(`SPAMMING ${button} FOR ${duration} MILLISECONDS`);
//     return new Promise((resolve, reject) => {
//         let f = 0;
//         const listener = () => {
//             if (f >= frames) {
//                 // console.log(`RELEASING BUTTON ${button} AFTER ${f} FRAMES`);
//                 xnes.removeListener("frame", listener);
//                 resolve();
//             }
//             if (f % 4 == 0) {
//                 tapButton(button);
//             } else {
//                 xnes.sendControl(0);
//             }
//             f++;
//         };
//         xnes.addListener("frame", listener);
//     });
// };

// const holdButton = (button: Button, frames: number): Promise<void> => {
//     console.log(`HOLDING BUTTON ${button} FOR ${frames} FRAMES`);
//     return new Promise((resolve, reject) => {
//         let f = 0;
//         const state = (2 ** button) << 2;
//         xnes.sendControl(state);
//         const listener = () => {
//             if (f >= frames) {
//                 // console.log(`RELEASING BUTTON ${button} AFTER ${f} FRAMES`);
//                 xnes.sendControl(0);
//                 xnes.removeListener("frame", listener);
//                 resolve();
//             }
//             f++;
//         }
//         xnes.addListener("frame", listener);
//     });

// }

// const wait = (frame: number): Promise<void> => {
//     // console.log(`WAITING FOR ${frame} FRAMES`);
//     return new Promise((resolve, reject) => {
//         let frames = 0;

//         const listener = () => {
//             if (frames >= frame) {
//                 xnes.removeListener("frame", listener);
//                 resolve();
//             }
//             frames++;
//         };
//         xnes.addListener("frame", listener);
//     });
// };

// const waitUntil = (frame: number): Promise<void> => {
//     // console.log(`WAITING UNTIL FRAME ${frame}`);
//     return new Promise((resolve, reject) => {
//         const listener = (e) => {
//             if (e.frame >= frame) {
//                 xnes.removeListener("frame", listener);
//                 resolve();
//             }
//         };

//         xnes.addListener("frame", listener);
//     });
// };

// const mode: number = Mode.VANILLA;
// const countryCode: string = CCode.JP;

// const getStartFrame = () => {
//     switch (countryCode) {
//         case CCode.DE:
//             return 300;
//         case CCode.JP:
//             return 400;
//     }
// }

// const getWriteCursorsSettleFrames = () => {
//     switch (countryCode) {
//         case CCode.DE:
//             return 2;
//         case CCode.JP:
//             return 3;
//     }
// }

// const frameMarker = {
//     startFrame: getStartFrame(),
//     menuTransitionFrames: 4,
//     writeCursorsSettleFrames: getWriteCursorsSettleFrames(),
//     selectGameFrames: 100,
// };

// const startControls = () => {
//     Promise.resolve()
//         .then(() => startGame())
//         .then(() => console.log("startGame sequence finished at frame: ", currentFrame))
//         .then(() => skipIntro())
//         .then(() => console.log("skipIntro sequence finished at frame: ", currentFrame))
//         .then(() => leaveHouse())
//         .then(() => console.log("leaveHouse sequence finished at frame: ", currentFrame))
//         .then(() => {
//             xnes.stop();
//             console.log('DONE');
//         })
//         .catch(console.error);
// };

// const startGame = (): Promise<void> => {
//     switch (countryCode) {
//         case CCode.DE:
//             return Promise.resolve()
//                 .then(() => waitUntil(frameMarker.startFrame))
//                 .then(() => tapButton(Button.START))
//                 .then(() => wait(frameMarker.selectGameFrames))
//                 .then(() => tapButton(Button.START))
//                 .then(() => wait(frameMarker.menuTransitionFrames))
//                 .then(() => holdButton(Button.LEFT, 18))
//                 .then(() => holdButton(Button.DOWN, 6))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X)) // On L
//                 .then(() => holdButton(Button.LEFT, 18))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X)) // On I
//                 .then(() => holdButton(Button.RIGHT, 18))
//                 .then(() => holdButton(Button.DOWN, 18))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X)) // On N
//                 .then(() => holdButton(Button.LEFT, 17))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X))
//                 .then(() => holdButton(Button.LEFT, 15))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X))
//                 .then(() => holdButton(Button.RIGHT, 30))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X))
//                 .then(() => tapButton(Button.START))
//                 .then(() => wait(frameMarker.menuTransitionFrames))
//                 .then(() => tapButton(Button.START))
//                 .catch(console.error);
//         case CCode.JP:
//             return Promise.resolve()
//                 .then(() => waitUntil(frameMarker.startFrame))
//                 .then(() => tapButton(Button.START))
//                 .then(() => wait(frameMarker.selectGameFrames))
//                 .then(() => tapButton(Button.START))
//                 .then(() => wait(frameMarker.menuTransitionFrames))
//                 .then(() => holdButton(Button.LEFT, 20))
//                 .then(() => holdButton(Button.DOWN, 10))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X))
//                 .then(() => holdButton(Button.LEFT, 18))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X))
//                 .then(() => holdButton(Button.RIGHT, 26))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X))
//                 .then(() => holdButton(Button.LEFT, 17))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X))
//                 .then(() => holdButton(Button.LEFT, 15))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X))
//                 .then(() => holdButton(Button.RIGHT, 30))
//                 .then(() => wait(frameMarker.writeCursorsSettleFrames))
//                 .then(() => tapButton(Button.X))
//                 .then(() => tapButton(Button.START))
//                 .then(() => wait(frameMarker.menuTransitionFrames))
//                 .then(() => tapButton(Button.START))
//                 .catch(console.error);
//     }

// };

// const skipIntro = (): Promise<void> => {
//     switch (mode) {
//         case Mode.RANDOMIZED:
//             return Promise.resolve()
//                 .then(() => wait(100))
//                 .then(() => tapButton(Button.X))
//                 .then(() => wait(50));
//         case Mode.VANILLA:
//             return Promise.resolve()
//                 .then(() => spamButton(Button.X, 1880))
//                 .catch(console.log);
//             break;
//     }
// };

// const leaveHouse = (): Promise<void> => {
//     return Promise.resolve()
//         .then(() => wait(100))
//         .then(() => holdButton(Button.RIGHT, 18))
//         .then(() => holdButton(Button.DOWN, 62))
//         .then(() => holdButton(Button.RIGHT, 50))
//         .then(() => tapButton(Button.UP))
//         .then(() => tapButton(Button.X))
//         .then(() => wait(100))
//         .then(() => tapButton(Button.X))
//         .then(() => wait(25))
//         .then(() => tapButton(Button.X))
//         .then(() => wait(25))
//         .then(() => holdButton(Button.LEFT, 50))
//         .then(() => holdButton(Button.DOWN, 50))
//         .then(() => wait(200))
//         .catch(console.error);
// };

// // startControls();
