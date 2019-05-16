import { EventEmitter } from "events";
import * as path from 'path';
import * as fs from 'fs';
import debug from 'debug';

const xnes = require('./xnes/output/snes9x');

// import * as xnes from './xnes/output/snes9x';

// import Module from './xnes/output/snes9x';

// const Module = xnes();

const dLog = debug('xnesRunner:log');
const dError = debug('xnesRunner:error');

export default class XNesRunner extends EventEmitter {

    romFilePath: string = path.resolve('./roms/ALttP - VT_no-glitches-30_normal-open_randomized-ganon_key-sanity_g5yoJW6mvm.sfc');
    Module: any;
    ModuleOptions: any;

    internalRomFilename: string;

    interval: NodeJS.Timeout;
    intervalSaveSRAM: NodeJS.Timeout;

    native_bitmap_pointer: any;
    native_set_joypad_state: any;
    mainloop: any;
    renderscreen: any;
    setFrameSkip: (frames: number) => void;
    runRom: (internalFilename: string) => void;


    constructor(romFilePath?: string) {
        super();

        if (romFilePath)
            this.romFilePath = romFilePath;



        this.ModuleOptions = {
            'onInit': this.onInit.bind(this),
            'preRun': [],
            'postRun': [],
            'print': (text: string) => dLog(text),
            'printErr': (text: string) => dError(text),
            'totalDependencies': 0,
            // 'wasmBinary': fs.readFileSync('./xnes/output/snes9x.wasm')
            monitorRunDependencies: (left) => {
                dLog(left);
            },
        }

        this.Module = xnes(this.ModuleOptions);



    }

    onInit(): void {
        dLog('init', this.Module);

        const internalDir = '/';
        const internalRomFileName = 'rom' + path.extname(this.romFilePath);

        console.log({
            internalDir,
            internalRomFileName
        })

        this.intervalSaveSRAM = setInterval(
            this.Module._S9xAutoSaveSRAM,
            10000
        );

        // const fileContent = Uint8Array.from(fs.readFileSync(this.romFilePath));
        this.Module["FS_createDataFile"](
            internalDir,
            internalRomFileName,
            fs.readFileSync(this.romFilePath),
            true,
            true,
        );

        dLog(Object.keys(this.Module.FS));
        // dLog('FileLoaded', result);

        // this.Module['_set_transparency'](0);
        this.Module.ccall('set_transparency', null, ['number'], 0);
        dLog('reset transparency');

        // this.Module['_set_frameskip'](0);
        // const setFrameSkip = this.Module.cwrap('set_frameskip', 'number', ['number']);
        // setFrameSkip(0);
        // this.Module.ccall('set_frameskip', 'number', ['number'], "0");
        dLog('reset frameskip');

        this.Module.ccall(
            'S9xInitInputDevices',
            'number',
            new Array(12).fill('number'),
            [39, 37, 40, 38, 32, 13, 68, 67, 83, 88, 65, 90]);
        dLog('reset InputDevices');

        // Object.keys(this.Module).forEach((item) => dLog(item));

        this.Module.ccall(
            'run',
            null,
            ['string'],
            [internalDir + internalRomFileName]
        );

        // this.interval = setInterval(this.onInterval, 100);

    }

    onInterval(): void {
        this.Module.requestAnimationFrame((data): void => {
            dLog('requestAnimationFrame');
            if (data)
                dLog("data", data);
            if (this.renderscreen)
                dLog('renderscreen', this.renderscreen);
            if (this.native_bitmap_pointer)
                dLog('native_bitmap_pointer', this.native_bitmap_pointer);
            if (this.native_set_joypad_state)
                dLog('native_set_joypad_state', this.native_set_joypad_state);
        });

    }

}


export interface XnesRunnerFrameEvent {
    frame: number;
    data: Int32Array;
}

const x = new XNesRunner();