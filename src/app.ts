import { app, BrowserWindow } from 'electron';
import express from 'express';
import * as path from 'path';
import VideoSource from './video-source';

// require('electron-reload')(__dirname);

// import * as XNES from './xnes_out/snes9x';

let win: BrowserWindow;

app.once('ready', () => {
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
        // console.log('show');
    });
    win.webContents.openDevTools();
    const filePath = path.resolve('./index.html');
    // const filePath = path.resolve('./xnes_out/snes9x.html');
    // console.log(filePath);
    win.loadFile(filePath);
});
