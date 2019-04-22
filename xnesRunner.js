"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const events_1 = require("events");
const path = tslib_1.__importStar(require("path"));
const fs = tslib_1.__importStar(require("fs"));
class XNesRunner extends events_1.EventEmitter {
    constructor(rom) {
        super();
        this.currentFrame = 0;
        const workerPath = path.resolve('snes9x.js');
        const fileContent = fs.readFileSync(rom);
        this.worker = new Worker(workerPath);
        this.worker.onerror = (e) => console.error(e);
        this.worker.onmessage = (e) => {
            switch (e.data.cmd) {
                case "print":
                    console.log("XNesRunner:", e.data.txt);
                    if (e.data.txt == "file loaded")
                        this.worker.postMessage({ cmd: 'start' });
                    break;
                case "render":
                    this.currentFrame++;
                    this.onFrame(this.currentFrame, e.data.src);
                    break;
                case "render2":
                    this.currentFrame++;
                    this.onFrame(this.currentFrame, new Int32Array(e.data.src));
                    break;
            }
        };
        this.worker.postMessage({ cmd: 'loadfile', buffer: fileContent });
    }
    onFrame(frame, data) {
        this.emit('frame', { frame, data });
    }
    sendControl(state) {
        this.worker.postMessage({ cmd: "joy1", state });
    }
    stop() {
        this.worker.terminate();
    }
}
exports.default = XNesRunner;
//# sourceMappingURL=xnesRunner.js.map