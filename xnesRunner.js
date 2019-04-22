"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const events_1 = require("events");
const path = tslib_1.__importStar(require("path"));
const fs = tslib_1.__importStar(require("fs"));
class XNesRunner extends events_1.EventEmitter {
    constructor(rom, canvas) {
        super();
        this.currentFrame = 0;
        if (!('transferControlToOffscreen' in canvas)) {
            console.error('webgl in worker unsupported');
            process.exit(1);
        }
        var offscreen = canvas.transferControlToOffscreen();
        const workerPath = path.resolve('snes9x.js');
        const fileContent = fs.readFileSync(rom);
        this.worker = new Worker(workerPath);
        this.worker.postMessage({
            cmd: 'canvas',
            canvas: offscreen
        }, [offscreen]);
        this.worker.postMessage({
            cmd: 'loadfile',
            buffer: fileContent
        });
        this.worker.onerror = (e) => console.error(e);
        this.worker.onmessage = (e) => {
            switch (e.data.cmd) {
                case "status":
                    if (e.data.txt == "ready") {
                        console.log("ready", e);
                        this.worker.postMessage({ cmd: 'start' });
                        setInterval(() => {
                            this.worker.terminate();
                        }, 20000);
                    }
                    break;
                case "print":
                    console.log("XNesRunner:", e.data.txt);
                    break;
                case 'error':
                    console.error("XNesRunner:", e.data.txt);
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
    }
    onFrame(frame, data) {
        this.emit('frame', { frame });
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