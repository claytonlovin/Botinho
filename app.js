// app.js
import whatsappWeb from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = whatsappWeb;
import { gerenciadorSessoes } from './src/gerenciadorFluxo.js';
import { GeminiWhatsAppHandler } from './src/GeminiWhatsAppHandler.js';
const { qrcode } = 'qrcode-terminal';
import { initializeDatabase } from './src/config/database.js'; // Importando a função de inicialização
import { AlunoRepository } from './src/repositories/AlunoRepository.js';

const geminiHandler = new GeminiWhatsAppHandler();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEBIDO');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente WhatsApp conectado com sucesso!');
    setTimeout(() => {
    }, 3000);
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

class SendMessage {
    constructor(client, chatId, message) {
        this.client = client;
        this.chatId = chatId;
        this.message = message;
    }

    async execute() {
        try {
            await this.client.sendMessage(this.chatId, this.message);
            console.log(`Mensagem enviada para ${this.chatId}: ${this.message}`);
        } catch (error) {
            console.error(`Erro ao enviar mensagem: ${error}`);
        }
    }
}

// Inicializa
const startApplication = async () => {
    try {
        await initializeDatabase();

        const alunoRepo = new AlunoRepository();
        const alunos = await alunoRepo.findAll();
        console.log('Alunos encontrados:', alunos);
        
        client.initialize();
        console.log('Aplicação iniciada com sucesso!');
        
    } catch (error) {
        console.error('Erro ao iniciar aplicação:', error);
        process.exit(1);
    }
};

// Tratamento  graceful
process.on('SIGINT', async () => {
    console.log('\n Encerrando aplicação...');
    
    try {
        const { AppDataSource } = await import('./src/config/database.js');
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('Conexão com banco encerrada');
        }
        
        // Destruir cliente WhatsApp
        await client.destroy();
        console.log('Cliente WhatsApp encerrado');
        
    } catch (error) {
        console.error('Erro ao encerrar aplicação:', error);
    }
    
    process.exit(0);
});


startApplication();