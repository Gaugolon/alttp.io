import { EventEmitter } from "events";
import * as path from 'path';
import * as fs from 'fs';

export default class XNesRunner extends EventEmitter {
    worker: Worker;
    currentFrame: number = 0;
    constructor(rom: string) {
        super();
        const workerPath = path.resolve('snes9x.js');
        const fileContent = fs.readFileSync(rom);
        this.worker = new Worker(workerPath);
        this.worker.onerror = (e: Event) => console.error(e);
        this.worker.onmessage = (e: MessageEvent) => {
            switch (e.data.cmd) {
                case "print":
                    console.log("XNesRunner:", e.data.txt);
                    if (e.data.txt == "file loaded")
                        this.worker.postMessage({ cmd: 'start' });
                    break;
                case "render":
                    this.currentFrame++;
                    this.onFrame(
                        this.currentFrame,
                        e.data.src
                    );
                    break;
                case "render2":
                    this.currentFrame++;
                    this.onFrame(
                        this.currentFrame,
                        new Int32Array(e.data.src as ArrayBuffer)
                    );
                    break;
            }
        };

        this.worker.postMessage({ cmd: 'loadfile', buffer: fileContent });
    }

    onFrame(frame: number, data: Int32Array) {
        // console.log("XNesRunner: onFrame");
        this.emit('frame', { frame, data });
    }

    sendControl(state: number) {
        this.worker.postMessage({ cmd: "joy1", state });
    }

    stop() {
        this.worker.terminate();
    }
}


export interface XnesRunnerFrameEvent {
    frame: number;
    data: Int32Array;
}
