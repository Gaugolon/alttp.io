"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const events_1 = require("events");
const path = tslib_1.__importStar(require("path"));
const fs = tslib_1.__importStar(require("fs"));
const debug_1 = tslib_1.__importDefault(require("debug"));
const xnes = require('./xnes/output/snes9x');
const dLog = debug_1.default('xnesRunner:log');
const dError = debug_1.default('xnesRunner:error');
class XNesRunner extends events_1.EventEmitter {
    constructor(romFilePath) {
        super();
        this.romFilePath = path.resolve('./roms/ALttP - VT_no-glitches-30_normal-open_randomized-ganon_key-sanity_g5yoJW6mvm.sfc');
        if (romFilePath)
            this.romFilePath = romFilePath;
        this.ModuleOptions = {
            'onInit': this.onInit.bind(this),
            'preRun': [],
            'postRun': [],
            'print': (text) => dLog(text),
            'printErr': (text) => dError(text),
            'totalDependencies': 0,
            monitorRunDependencies: (left) => {
                dLog(left);
            },
        };
        this.Module = xnes(this.ModuleOptions);
    }
    onInit() {
        dLog('init', this.Module);
        const internalDir = '/';
        const internalRomFileName = 'rom' + path.extname(this.romFilePath);
        console.log({
            internalDir,
            internalRomFileName
        });
        this.intervalSaveSRAM = setInterval(this.Module._S9xAutoSaveSRAM, 10000);
        this.Module["FS_createDataFile"](internalDir, internalRomFileName, fs.readFileSync(this.romFilePath), true, true);
        dLog(Object.keys(this.Module.FS));
        this.Module.ccall('set_transparency', null, ['number'], 0);
        dLog('reset transparency');
        dLog('reset frameskip');
        this.Module.ccall('S9xInitInputDevices', 'number', new Array(12).fill('number'), [39, 37, 40, 38, 32, 13, 68, 67, 83, 88, 65, 90]);
        dLog('reset InputDevices');
        this.Module.ccall('run', null, ['string'], [internalDir + internalRomFileName]);
    }
    onInterval() {
        this.Module.requestAnimationFrame((data) => {
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
exports.default = XNesRunner;
const x = new XNesRunner();
//# sourceMappingURL=xnesRunner.js.map