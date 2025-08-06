const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let win;
let isConnected = false;

// Criar cliente WhatsApp antes do app ready
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "botinho",
    dataPath: path.join(__dirname, 'wwebjs_auth')
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Eventos do cliente
client.on('qr', async (qr) => {
  if (!isConnected && win) {
    console.log('📌 Gerando QR...');
    const dataUrl = await qrcode.toDataURL(qr);
    win.webContents.send('qr-code', dataUrl);
  }
});

client.on('ready', () => {
  isConnected = true;
  console.log('WhatsApp conectado!');
  if (win) win.webContents.send('whatsapp-connected');
});

client.on('disconnected', () => {
  isConnected = false;
  console.log('WhatsApp desconectado!');
  if (win) win.webContents.send('whatsapp-disconnected');
});

// Inicializa o client logo que o app estiver pronto
app.whenReady().then(() => {
  createWindow();
  client.initialize();
});

// Cria a janela do Electron
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}

// Eventualmente o renderer pode pedir status ou iniciar novamente, mas não deve inicializar o client
ipcMain.on('start-whatsapp', () => {
  if (isConnected) {
    console.log('ℹ️ Já conectado, carregando tela conectada...');
    win.loadFile('connected.html');

    win.webContents.once('did-finish-load', () => {
      console.log('connected.html carregado, enviando evento...');
      win.webContents.send('whatsapp-connected');
    });
  } else {
    console.log('⚠️ Cliente ainda não conectado, aguardando inicialização...');
  }
});

