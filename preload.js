const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('botinho', {
  generateQRCode: (text) => ipcRenderer.invoke('generate-qrcode', text)
});
