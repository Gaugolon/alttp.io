import { EventEmitter } from "events";
import * as path from 'path';
import * as fs from 'fs';

export default class XNesRunner extends EventEmitter {
    worker: Worker;
    currentFrame: number = 0;
    constructor(rom: string, canvas: any) {
        super();

        if (!('transferControlToOffscreen' in canvas)) {
            console.error('webgl in worker unsupported');
            process.exit(1);
        }

        var offscreen = canvas.transferControlToOffscreen();
        const workerPath = path.resolve('snes9x.js');
        const fileContent: ArrayBuffer = fs.readFileSync(rom);
        this.worker = new Worker(workerPath);
        this.worker.postMessage({
            cmd: 'canvas',
            canvas: offscreen
        }, [offscreen]);
        this.worker.postMessage({
            cmd: 'loadfile',
            buffer: fileContent
        });

        this.worker.onerror = (e: Event) => console.error(e);
        this.worker.onmessage = (e: MessageEvent) => {
            // console.log(e);
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
                    // if (e.data.txt == "file loaded")
                    //     this.worker.postMessage({ cmd: 'start' });
                    break;
                case 'error':
                    console.error("XNesRunner:", e.data.txt);
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

    }

    onFrame(frame: number, data: Int32Array) {
        // console.log("XNesRunner: onFrame");
        this.emit('frame', { frame });
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
