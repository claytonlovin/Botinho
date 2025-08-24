const { contextBridge, ipcRenderer } = require('electron');
//const { getFluxo,  saveFluxo} = require('./database/fluxoRepository');

contextBridge.exposeInMainWorld('botinho', {
  startWhatsapp: () => ipcRenderer.send('start-whatsapp'),
  onQrCode: (callback) => ipcRenderer.on('qr-code', (event, data) => callback(data)),
  onConnected: (callback) => ipcRenderer.on('whatsapp-connected', callback),
  onDisconnected: (callback) => ipcRenderer.on('whatsapp-disconnected', callback),

  getFluxo: () => ipcRenderer.invoke('get-fluxo'),
  saveFluxo: (fluxoObj) => ipcRenderer.invoke('save-fluxo', fluxoObj)
});

