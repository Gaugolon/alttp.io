import { EventEmitter } from "events";
import * as path from 'path';
import * as fs from 'fs';

export default class XNesRunner extends EventEmitter {
    worker: Worker;
    currentFrame: number = 0;
    constructor(rom: string) {
        super();
        const workerPath = path.resolve('ww.js');
        const fileContent = fs.readFileSync(rom);
        this.worker = new Worker(workerPath);
        this.worker.onerror = (e: Event) => console.error(e);
        this.worker.onmessage = (e: MessageEvent) => {
            switch (e.data.cmd) {
                case "print":
                    console.log("XNesRunner:", e.data.txt);
                    break;
                case "render":
                    this.currentFrame++;
                    this.onFrame(this.currentFrame, e.data.src);
            }
        };

        this.worker.postMessage({ cmd: 'loadfile', buffer: fileContent });
        this.worker.postMessage({ cmd: 'start' });
    }

    onFrame(frame: number, data: Int32Array) {
        // console.log("XNesRunner: onFrame");
        this.emit('frame', { frame, data });
    }

    sendControl(state: number) {
        this.worker.postMessage({ cmd: "joy1", state });
    }
}


export interface XnesRunnerFrameEvent {
    frame: number;
    data: Int32Array;
}
