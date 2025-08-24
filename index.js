const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { gerenciadorSessoes } = require('./src/gerenciadorFluxo.js');
const { GeminiWhatsAppHandler } = require('./src/GeminiWhatsAppHandler.js');
const qrcode = require('qrcode');
const fluxoRepository = require('./database/fluxoRepository');

let win;
let isConnected = false;
let geminiHandler; 

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
  
  // Inicializar o GeminiHandler
  try {
    geminiHandler = new GeminiWhatsAppHandler();
    console.log('🤖 GeminiHandler inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar GeminiHandler:', error.message);
  }
  
  if (win) win.webContents.send('whatsapp-connected');
});

client.on('disconnected', () => {
  isConnected = false;
  console.log('WhatsApp desconectado!');
  if (win) win.webContents.send('whatsapp-disconnected');
});


client.on('message', async (message) => {
    const numero = message.from;
    const entrada = message.body;

    const resposta = await gerenciadorSessoes.processarEntrada(numero, entrada, client, geminiHandler);

    if (resposta) {
        await client.sendMessage(numero, resposta);
    }
    
    if (entrada.toLowerCase() === 'sair') {
        gerenciadorSessoes.removerSessao(numero);
        await client.sendMessage(numero, 'Sessão encerrada. Até logo!');
    }
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

  win.loadFile('views/index.html');
  
}

// Eventualmente o renderer pode pedir status ou iniciar novamente, mas não deve inicializar o client
ipcMain.on('start-whatsapp', async (message) => {
  if(isConnected){
    console.log('ℹ️ Já conectado, carregando tela conectada...');
    win.loadFile('views/connected.html');

    win.webContents.once('did-finish-load', () => {
      console.log('connected.html carregado, enviando evento...');
      win.webContents.send('whatsapp-connected');
    });

    // Inicializa o fluxo de atendimento
    const numero = message.from;
    const entrada = message.body;

    const resposta = await gerenciadorSessoes.processarEntrada(numero, entrada, client, geminiHandler);
    console.log('DEBUG - resposta:', resposta);


    if (resposta) {
        await client.sendMessage(numero, resposta);
    }
    
    if (entrada.toLowerCase() === 'sair') {
        gerenciadorSessoes.removerSessao(numero);
        await client.sendMessage(numero, 'Sessão encerrada. Até logo!');
    }

    
  } else {
    console.log('⚠️ Cliente ainda não conectado, aguardando inicialização...');
  }
});


ipcMain.handle('get-fluxo', async () => {
  return new Promise((resolve, reject) => {
    fluxoRepository.getFluxo((err, fluxo) => {
      if (err) {
        console.error('Erro ao obter fluxo:', err);
        reject(err);
      } else {
        resolve(fluxo);
      }
    });
  });
});

ipcMain.handle('save-fluxo', async (event, fluxoObj) => {
  return new Promise((resolve, reject) => {
    fluxoRepository.saveFluxo(fluxoObj, (err) => {
      if (err) reject(err);
      else resolve({ success: true });
    });
  });
});