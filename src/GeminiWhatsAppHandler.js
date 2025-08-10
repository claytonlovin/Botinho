const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY não encontrada no arquivo .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

class GeminiWhatsAppHandler {
  constructor() {
    this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.conversationHistory = new Map(); // Armazena histórico por número
    this.assessmentState = new Map(); // Estado da avaliação por usuário
    this.assessmentResults = new Map(); // Resultados da avaliação
    this.quotaExceeded = false; // Flag para controlar quota
    this.lastQuotaCheck = 0; // Timestamp da última verificação
    
    // Definição das perguntas da avaliação
    this.assessmentQuestions = [
      {
        id: 1,
        type: 'text',
        question: 'Hello, my name is Ellen IA. Please introduce yourself in English.',
        instruction: 'Responda em forma de texto'
      },
      {
        id: 2,
        type: 'text',
        question: 'Perfect! What is your profession?',
        instruction: 'Responda em forma de texto'
      },
      {
        id: 3,
        type: 'audio',
        question: 'What is your biggest dream?',
        instruction: 'Responda em áudio - Grave áudio aqui no WhatsApp'
      },
      {
        id: 4,
        type: 'audio',
        question: 'What is your goal with English?',
        instruction: 'Responda em áudio - Grave áudio aqui no WhatsApp'
      },
      {
        id: 5,
        type: 'audio',
        question: 'Muito bem. Agora grave um áudio, repetindo a seguinte frase:\n\n"English is one of the most widely spoken languages in the world. I\'m looking forward to starting my course soon."',
        instruction: 'Grave o áudio repetindo a frase exatamente como mostrada'
      }
    ];
    
    // Timeout para respostas (5 minutos)
    this.responseTimeout = 5 * 60 * 1000;
  }

  // Verifica se a quota da API está disponível
  checkQuotaStatus() {
    const now = Date.now();
    
    // Se quota foi excedida há menos de 1 hora, não tenta novamente
    if (this.quotaExceeded && (now - this.lastQuotaCheck) < 3600000) {
      return false;
    }
    
    // Reset quota status se passou tempo suficiente
    if (this.quotaExceeded && (now - this.lastQuotaCheck) >= 3600000) {
      this.quotaExceeded = false;
      console.log('🔄 Resetando status de quota - tentando novamente');
    }
    
    return !this.quotaExceeded;
  }

  // Marca quota como excedida
  markQuotaExceeded() {
    this.quotaExceeded = true;
    this.lastQuotaCheck = Date.now();
    console.log('🚫 Quota marcada como excedida');
  }

  // Função para aguardar com delay
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Função para converter arquivo de áudio para base64
  audioToBase64(filePath) {
    try {
      const audioFile = fs.readFileSync(filePath);
      return audioFile.toString('base64');
    } catch (error) {
      throw new Error(`Erro ao ler arquivo de áudio: ${error.message}`);
    }
  }

  // Função para determinar MIME type
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mp3',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac'
    };
    return mimeTypes[ext] || 'audio/ogg';
  }

  // Inicia uma nova avaliação
  startAssessment(numero) {
    const assessmentData = {
      currentQuestion: 1,
      startTime: Date.now(),
      lastActivity: Date.now(),
      answers: [],
      isActive: true,
      completed: false
    };
    
    this.assessmentState.set(numero, assessmentData);
    this.clearHistory(numero);
    
    console.log(`🎯 Iniciando avaliação para usuário ${numero}`);
    return this.getCurrentQuestion(numero);
  }

  // Obtém a pergunta atual formatada
  getCurrentQuestion(numero) {
    const state = this.assessmentState.get(numero);
    if (!state || !state.isActive) {
      return this.startAssessment(numero);
    }

    const questionData = this.assessmentQuestions[state.currentQuestion - 1];
    if (!questionData) {
      return this.finishAssessment(numero);
    }

    const questionText = `📝 *Pergunta ${questionData.id}/5* - Nível: Level\n\n` +
                        `${questionData.question}\n\n` +
                        `*${questionData.instruction}*`;

    return questionText;
  }

  // Processa resposta da avaliação
  async processAssessmentResponse(numero, message, isAudio = false) {
    const state = this.assessmentState.get(numero);
    if (!state || !state.isActive) {
      return "🤖 Avaliação não iniciada. Digite 'iniciar' para começar.";
    }

    // Verifica quota antes de processar
    if (!this.checkQuotaStatus()) {
      state.isActive = false; // Pausa avaliação
      return "🚫 *Estamos processando muita informação*\n\n" +
             "Atingimos o limite de solicitações por minutos. Sua avaliação ficará pausada.\n\n" +
             "⏰ Tente novamente em algumas horas ou amanhã.\n" +
             "Digite *iniciar* para continuar quando disponível!";
    }

    // Verifica timeout
    if (Date.now() - state.lastActivity > this.responseTimeout) {
      return this.timeoutAssessment(numero);
    }

    const currentQuestion = this.assessmentQuestions[state.currentQuestion - 1];
    
    // Verifica se o tipo de resposta está correto
    if (currentQuestion.type === 'audio' && !isAudio) {
      return `⚠️ Esta pergunta precisa ser respondida em *áudio*. ${currentQuestion.instruction}`;
    }
    
    if (currentQuestion.type === 'text' && isAudio) {
      return `⚠️ Esta pergunta precisa ser respondida em *texto*. ${currentQuestion.instruction}`;
    }

    // Processa a resposta
    let processedAnswer = '';
    let score = 0;

    try {
      if (isAudio) {
        // Avalia resposta de áudio
        const evaluation = await this.evaluateAudioResponse(message, currentQuestion);
        processedAnswer = evaluation.transcription;
        score = evaluation.score;
      } else {
        // Avalia resposta de texto
        const evaluation = await this.evaluateTextResponse(message, currentQuestion);
        processedAnswer = evaluation.answer;
        score = evaluation.score;
      }

      // Armazena a resposta
      state.answers.push({
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        answer: processedAnswer,
        type: currentQuestion.type,
        score: score,
        timestamp: Date.now()
      });

      // Atualiza estado
      state.lastActivity = Date.now();
      state.currentQuestion++;

      // Verifica se terminou
      if (state.currentQuestion > this.assessmentQuestions.length) {
        return this.finishAssessment(numero);
      }

      // Vai para próxima pergunta
      const nextQuestion = this.getCurrentQuestion(numero);
      return `✅ Resposta registrada!\n\n${nextQuestion}`;

    } catch (error) {
      console.error('❌ Erro ao processar resposta:', error.message);
      
      // Se erro de quota, marca como excedida
      if (error.message.includes('quota') || error.message.includes('429')) {
        this.markQuotaExceeded();
        state.isActive = false;
        return "🥹 *Estamos processando muita informação*\n\n" +
               "Atingimos o limite de solicitações por minutos. Sua avaliação ficará pausada.\n\n" +
               "⏰ Tente novamente em algumas horas ou amanhã.\n";
      }

      return "🤖 Erro ao processar sua resposta. Pode tentar novamente?";
    }
  }

  // Avalia resposta de texto
  async evaluateTextResponse(text, questionData) {
    const prompt = `
      Avalie esta resposta em inglês para a pergunta: "${questionData.question}"
      
      Resposta do aluno: "${text}"
      
      Critérios de avaliação:
      - Gramática (0-25 pontos)
      - Vocabulário (0-25 pontos)
      - Fluência/Naturalidade (0-25 pontos)
      - Relevância à pergunta (0-25 pontos)
      
      Retorne apenas um JSON no formato:
      {
        "answer": "resposta_do_aluno",
        "score": nota_total_0_a_100,
        "feedback": "feedback_breve"
      }
    `;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    
    try {
      const evaluation = JSON.parse(response.text());
      return evaluation;
    } catch (error) {
      // Fallback se não conseguir parsear JSON
      return {
        answer: text,
        score: 70, // Pontuação média como fallback
        feedback: "Resposta processada"
      };
    }
  }

  // Avalia resposta de áudio
  async evaluateAudioResponse(audioData, questionData) {
    // Se audioData é um caminho de arquivo, processa normalmente
    if (audioData.includes('/') || audioData.includes('temp_audio_') || audioData.includes('.ogg')) {
      const prompt = `
        Transcreva este áudio em inglês e avalie a resposta para: "${questionData.question}"
        
        Critérios de avaliação:
        - Pronúncia (0-25 pontos)
        - Gramática (0-25 pontos)
        - Vocabulário (0-25 pontos)
        - Fluência (0-25 pontos)
        
        Retorne apenas um JSON no formato:
        {
          "transcription": "transcrição_do_áudio",
          "score": nota_total_0_a_100,
          "feedback": "feedback_sobre_pronúncia_e_conteúdo"
        }
      `;

      const audioBase64 = this.audioToBase64(audioData);
      const mimeType = this.getMimeType(audioData);
      
      const result = await this.model.generateContent([
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType
          }
        },
        prompt
      ]);

      const response = await result.response;
      
      try {
        const evaluation = JSON.parse(response.text());
        return evaluation;
      } catch (error) {
        return {
          transcription: "Áudio processado",
          score: 70,
          feedback: "Áudio analisado"
        };
      }
    } 
    
    // Se audioData é texto (transcrição já feita), avalia como texto de áudio
    else {
      console.log(`🎤 Avaliando transcrição de áudio: "${audioData}"`);
      
      const prompt = `
        Avalie esta resposta falada (já transcrita) em inglês para: "${questionData.question}"
        
        Transcrição: "${audioData}"
        
        Critérios de avaliação para resposta falada:
        - Gramática (0-25 pontos)
        - Vocabulário (0-25 pontos)
        - Fluência/Naturalidade (0-25 pontos)
        - Relevância à pergunta (0-25 pontos)
        
        Nota: Esta é uma transcrição de áudio, então avalie considerando linguagem falada.
        
        Retorne apenas um JSON no formato:
        {
          "transcription": "transcrição_fornecida",
          "score": nota_total_0_a_100,
          "feedback": "feedback_sobre_conteúdo_falado"
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      try {
        const evaluation = JSON.parse(response.text());
        // Garante que a transcrição seja preservada
        evaluation.transcription = audioData;
        return evaluation;
      } catch (error) {
        return {
          transcription: audioData,
          score: 70,
          feedback: "Resposta falada processada"
        };
      }
    }
  }

  // Finaliza avaliação
  finishAssessment(numero) {
    const state = this.assessmentState.get(numero);
    if (!state) return "🤖 Nenhuma avaliação em andamento.";

    state.isActive = false;
    state.completed = true;
    state.endTime = Date.now();

    // Calcula pontuação final
    const totalScore = state.answers.reduce((sum, answer) => sum + answer.score, 0);
    const averageScore = Math.round(totalScore / state.answers.length);

    // Armazena resultado final
    const finalResult = {
      userId: numero,
      startTime: state.startTime,
      endTime: state.endTime,
      duration: state.endTime - state.startTime,
      answers: state.answers,
      totalScore: totalScore,
      averageScore: averageScore,
      level: this.getLevel(averageScore)
    };

    this.assessmentResults.set(numero, finalResult);

    console.log(`✅ Avaliação finalizada para ${numero} - Pontuação: ${averageScore}`);

    return `🎉 *Avaliação Concluída!*\n\n` +
           `📊 *Sua pontuação final: ${averageScore}/100*\n` +
           `📈 *Nível estimado: ${finalResult.level}*\n\n` +
           `Obrigada por participar da avaliação! ` +
           `Em breve você receberá mais informações sobre o curso.\n\n` +
           `👋 Tenha um ótimo dia!`;
  }

  // Timeout da avaliação
  timeoutAssessment(numero) {
    const state = this.assessmentState.get(numero);
    if (state) {
      state.isActive = false;
      console.log(`⏱️ Timeout da avaliação para ${numero}`);
    }

    return `⏰ *Tempo esgotado!*\n\n` +
           `A avaliação foi finalizada por falta de resposta.\n` +
           `Digite 'iniciar' se quiser tentar novamente.\n\n` +
           `Obrigada!`;
  }

  // Determina nível baseado na pontuação
  getLevel(score) {
    if (score >= 90) return "Advanced";
    if (score >= 75) return "Upper-Intermediate";
    if (score >= 60) return "Intermediate";
    if (score >= 45) return "Pre-Intermediate";
    if (score >= 30) return "Elementary";
    return "Beginner";
  }

  // Função principal para processar mensagens do WhatsApp
  async processWhatsAppMessage(message, client) {
    try {
      const numero = message.from;
      const isGrupo = message.isGroupMsg || message.from.endsWith('@g.us');
      
      // Ignora grupos para avaliação
      if (isGrupo) {
        return await this.processGroupMention(message.body || "");
      }

      console.log(`📱 Processando mensagem de ${numero}`);

      // Verifica comandos especiais
      const text = (message.body || "").toLowerCase().trim();
      if (text === 'iniciar' || text === 'start' || text === 'começar') {
        return this.startAssessment(numero);
      }

      if (text === 'parar' || text === 'stop' || text === 'cancelar') {
        this.assessmentState.delete(numero);
        return "🛑 Avaliação cancelada. Digite 'iniciar' para começar novamente.";
      }

      // Verifica se há avaliação ativa
      const state = this.assessmentState.get(numero);
      if (!state || !state.isActive) {
        return `👋 Olá! Sou a Ellen IA.\n\n` +
               `Estou aqui para fazer uma avaliação do seu nível de inglês.\n` +
               `São apenas 5 perguntas rápidas! 🎯\n\n` +
               `Digite *iniciar* Para começar a avaliação.`;
      }

      // Processa áudio
      if (message.hasMedia && message.type === 'ptt') {
        console.log('🎤 Processando resposta em áudio...');
        
        const media = await message.downloadMedia();
        const tempFileName = `temp_audio_${Date.now()}.ogg`;
        const tempFilePath = path.join(process.cwd(), tempFileName);
        
        const audioBuffer = Buffer.from(media.data, 'base64');
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        try {
          return await this.processAssessmentResponse(numero, tempFilePath, true);
        } finally {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }
      }
      
      // Processa texto
      else if (message.body && message.body.trim()) {
        console.log('💬 Processando resposta em texto...');
        return await this.processAssessmentResponse(numero, message.body.trim(), false);
      }
      
      // Outros tipos de mídia
      else if (message.hasMedia) {
        return "🤖 Para a avaliação, preciso apenas de respostas em texto ou áudio. Pode tentar novamente?";
      }
      
      return "🤖 Não consegui entender. Pode responder à pergunta atual?";
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error.message);
      
      if (error.message.includes('quota') || error.message.includes('429')) {
        return "🤖 Desculpe, estou com limite de uso da API no momento. Tente novamente em alguns minutos! 😅";
      }
      
      return "🤖 Ops! Tive um problema técnico. Pode tentar novamente?";
    }
  }

  // Função para obter resultados da avaliação
  getAssessmentResult(numero) {
    return this.assessmentResults.get(numero);
  }

  // Função para listar todas as avaliações
  getAllAssessmentResults() {
    return Array.from(this.assessmentResults.values());
  }

  // Atualiza histórico da conversa
  updateHistory(numero, role, content) {
    if (!this.conversationHistory.has(numero)) {
      this.conversationHistory.set(numero, []);
    }
    
    const history = this.conversationHistory.get(numero);
    history.push({ role, content, timestamp: Date.now() });
    
    // Mantém apenas últimas 20 interações para não sobrecarregar
    if (history.length > 40) {
      history.splice(0, history.length - 40);
    }
    
    this.conversationHistory.set(numero, history);
  }

  // Limpa histórico de um usuário
  clearHistory(numero) {
    this.conversationHistory.delete(numero);
  }

  // Função para resposta simples em grupos (mantida como estava)
  async processGroupMention(entrada) {
    try {
      const input = entrada.toLowerCase().trim();
      const textoLimpo = input.replace(/@\w+/g, '').trim();
      
      if (textoLimpo.length < 10) {
        const respostasRapidas = {
          'oi': '👋 Olá! Me mande uma mensagem privada para fazer sua avaliação de inglês!',
          'olá': '👋 Oi! Me mande uma mensagem privada para começar sua avaliação!',
          'hello': '👋 Hello! Send me a private message to start your English assessment!',
          'ajuda': '🤖 Estou aqui para avaliar seu inglês! Me mande uma mensagem privada.',
          'obrigado': '😊 De nada! Sempre às ordens!',
          'thanks': '😊 You\'re welcome!'
        };
        
        for (const [palavra, resposta] of Object.entries(respostasRapidas)) {
          if (textoLimpo.includes(palavra)) {
            return resposta;
          }
        }
      }
      
      return '🤖 Oi! Me mande uma mensagem privada para fazer sua avaliação de inglês! 😊';
      
    } catch (error) {
      console.error('❌ Erro na resposta de grupo:', error.message);
      return '🤖 Oi! Me mande uma mensagem privada para conversarmos melhor! 😊';
    }
  }

  // Método específico para processar áudios via SessaoUsuario
  async processAudioMessage(numero, audioData) {
    try {
      console.log(`🎤 ProcessAudioMessage chamado para ${numero}`);
      
      // Verifica se há avaliação ativa
      const state = this.assessmentState.get(numero);
      
      if (!state || !state.isActive) {
        return `👋 Olá! Sou a Ellen IA.\n\n` +
               `Estou aqui para fazer uma avaliação do seu nível de inglês.\n` +
               `São apenas 5 perguntas rápidas! 🎯\n\n` +
               `Digite *iniciar* para começar a avaliação.`;
      }

      // Se há avaliação ativa, processa como áudio
      console.log(`🎤 Processando áudio para pergunta ${state.currentQuestion}`);
      return await this.processAssessmentResponse(numero, audioData, true);
      
    } catch (error) {
      console.error('❌ Erro no processAudioMessage:', error.message);
      return "🤖 Erro ao processar seu áudio. Pode tentar novamente?";
    }
  }

  // Método processPrompt para compatibilidade com SessaoUsuario
  async processPrompt(numero, entrada, messageType = 'text') {
    try {
      console.log(`🎯 ProcessPrompt chamado para ${numero} com entrada: "${entrada}" - Tipo: ${messageType}`);
      
      // Verifica comandos especiais primeiro (expandido)
      const text = entrada.toLowerCase().trim();
      
      // Comandos para iniciar
      if (text === 'iniciar' || text === 'start' || text === 'começar') {
        return this.startAssessment(numero);
      }

      // Comandos para parar/sair/voltar
      if (text === 'parar' || text === 'stop' || text === 'cancelar' || 
          text === 'sair' || text === 'exit' || text === 'quit' ||
          text === 'voltar' || text === 'volta' || text === 'back') {
        this.assessmentState.delete(numero);
        this.clearHistory(numero);
        return "🛑 Avaliação cancelada.\n\n" +
               "Digite *iniciar* para começar uma nova avaliação quando quiser.\n\n" +
               "👋 Até mais!";
      }

      // Comandos informativos (sem usar API)
      if (text === 'ajuda' || text === 'help') {
        return "🤖 *Comandos disponíveis:*\n\n" +
               "• *iniciar* - Começar avaliação\n" +
               "• *parar* - Cancelar avaliação\n" +
               "• *status* - Ver progresso\n" +
               "• *resultado* - Ver resultado final\n\n" +
               "📝 Durante a avaliação, responda as perguntas em inglês!";
      }

      if (text === 'status') {
        const state = this.assessmentState.get(numero);
        if (state && state.isActive) {
          return `📊 *Status da Avaliação*\n\n` +
                 `📝 Pergunta atual: ${state.currentQuestion}/5\n` +
                 `⏰ Iniciada: ${new Date(state.startTime).toLocaleTimeString()}\n\n` +
                 `Continue respondendo à pergunta atual!`;
        }
        return "📊 Nenhuma avaliação ativa.\n\nDigite *iniciar* para começar!";
      }

      if (text === 'resultado' || text === 'result') {
        const result = this.getAssessmentResult(numero);
        if (result) {
          return `🎯 *Seu Resultado Final*\n\n` +
                 `📊 Pontuação: ${result.averageScore}/100\n` +
                 `📈 Nível: ${result.level}\n` +
                 `⏱️ Duração: ${Math.round(result.duration / 1000 / 60)} minutos\n\n` +
                 `🎉 Parabéns por completar a avaliação!`;
        }
        return "📊 Nenhum resultado encontrado.\n\nComplete uma avaliação primeiro!";
      }

      // Verifica se há avaliação ativa
      const state = this.assessmentState.get(numero);
      
      if (state && state.isActive) {
        // Detecção inteligente de áudio baseada no conteúdo da entrada
        const isAudio = messageType === 'audio' || 
                       entrada.includes('[Enviou áudio]') || 
                       entrada.includes('temp_audio_') ||
                       entrada.startsWith('audio:') ||
                       // Se a pergunta atual requer áudio e a resposta parece ser transcrição
                       (this.assessmentQuestions[state.currentQuestion - 1]?.type === 'audio' && 
                        (entrada.length > 20 || entrada.includes('áudio') || entrada.includes('audio')));
        
        console.log(`📝 Avaliação ativa - processando resposta para pergunta ${state.currentQuestion} - isAudio: ${isAudio}`);
        
        // Se a pergunta requer áudio mas chegou como texto, assume que é transcrição de áudio
        const currentQuestion = this.assessmentQuestions[state.currentQuestion - 1];
        if (currentQuestion?.type === 'audio' && !isAudio) {
          console.log(`🎤 Pergunta requer áudio, mas chegou como texto - assumindo que é transcrição`);
          return await this.processAssessmentResponse(numero, entrada, true);
        }
        
        return await this.processAssessmentResponse(numero, entrada, isAudio);
      }

      // Se não há avaliação ativa, FORÇA iniciar uma nova avaliação
      console.log(`🎯 Nenhuma avaliação ativa - iniciando nova avaliação para ${numero}`);
      return this.startAssessment(numero);
      
    } catch (error) {
      console.error('❌ Erro no processPrompt:', error.message);
      
      // Tratamento específico para erro de quota
      if (error.message.includes('quota') || error.message.includes('429') || 
          error.message.includes('Too Many Requests')) {
        console.log('🚫 Quota da API excedida - pausando avaliação');
        
        // Pausa a avaliação atual
        const state = this.assessmentState.get(numero);
        if (state) {
          state.isActive = false;
        }
        
        return "🚫 *Limite da API atingido!*\n\n" +
               "Infelizmente atingimos o limite diário de uso da API do Gemini (50 requests/dia no plano gratuito).\n\n" +
               "⏰ *O que fazer:*\n" +
               "• Aguarde algumas horas e tente novamente\n" +
               "• Ou tente amanhã\n" +
               "• Sua avaliação ficará salva para continuar depois\n\n" +
               "Digite *iniciar* mais tarde para continuar!\n\n" +
               "😅 Desculpe pelo inconveniente!";
      }
      
      return "🤖 Ops! Tive um problema técnico. Pode tentar novamente em alguns minutos?";
    }
  }

  // Método principal de processamento (para compatibilidade com código existente)
  async processMessage(message, client) {
    return await this.processWhatsAppMessage(message, client);
  }

  // Método alternativo de processamento
  async handleMessage(message, client) {
    return await this.processWhatsAppMessage(message, client);
  }

  // Método para processar comando específico
  async processCommand(command, numero, args = []) {
    switch (command.toLowerCase()) {
      case 'iniciar':
      case 'start':
      case 'começar':
        return this.startAssessment(numero);
      
      case 'parar':
      case 'stop':
      case 'cancelar':
        this.assessmentState.delete(numero);
        return "🛑 Avaliação cancelada. Digite 'iniciar' para começar novamente.";
      
      case 'status':
        const state = this.assessmentState.get(numero);
        if (state && state.isActive) {
          return `📊 Avaliação em andamento - Pergunta ${state.currentQuestion}/5`;
        }
        return "📊 Nenhuma avaliação ativa.";
      
      case 'resultado':
      case 'result':
        const result = this.getAssessmentResult(numero);
        if (result) {
          return `🎯 Seu resultado: ${result.averageScore}/100 - Nível: ${result.level}`;
        }
        return "📊 Nenhum resultado encontrado.";
      
      default:
        return "🤖 Comando não reconhecido. Use: iniciar, parar, status, resultado";
    }
  }

  // Testa conexão com API
  async testConnection() {
    try {
      console.log("🔍 Testando conexão com Gemini API...");
      
      const result = await this.model.generateContent("Responda apenas: API funcionando");
      const response = await result.response;
      
      console.log("✅ API conectada com sucesso!");
      console.log("📊 Resposta de teste:", response.text());
      return true;
      
    } catch (error) {
      console.error("❌ Erro na conexão:", error.message);
      return false;
    }
  }
}

module.exports = { GeminiWhatsAppHandler };