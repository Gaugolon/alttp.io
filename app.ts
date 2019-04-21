import { app, BrowserWindow } from 'electron';
import * as path from 'path';
require('electron-reload')(__dirname);

let win: BrowserWindow;

app.once('ready', () => {
    console.log('APP READY');
    win = new BrowserWindow({
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

app.on('window-all-closed', () => {
    app.quit();
});