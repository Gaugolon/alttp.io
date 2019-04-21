"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const electron_1 = require("electron");
const path = tslib_1.__importStar(require("path"));
require('electron-reload')(__dirname);
let win;
electron_1.app.once('ready', () => {
    console.log('APP READY');
    win = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            nativeWindowOpen: true,
            nodeIntegrationInWorker: true
        }
    });
    win.on('show', () => {
        console.log('show');
    });
    win.webContents.openDevTools();
    win.loadFile(path.resolve('./index.html'));
});
electron_1.app.on('window-all-closed', () => {
    electron_1.app.quit();
});
//# sourceMappingURL=app.js.map