"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const electron_1 = require("electron");
const path = tslib_1.__importStar(require("path"));
let win;
electron_1.app.once('ready', () => {
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
    });
    win.webContents.openDevTools();
    const filePath = path.resolve('./index.html');
    win.loadFile(filePath);
});
//# sourceMappingURL=app.js.map