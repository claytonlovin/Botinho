const whatsapp = require('whatsapp-web.js');
const { MessageMedia } = whatsapp;
const { GeminiWhatsAppHandler } = require('./GeminiWhatsAppHandler.js');


class SessaoUsuario {
    constructor(numero, fluxoRaiz, client, geminiHandler) {
        this.numero = numero;
        this.fluxo = fluxoRaiz;
        this.etapaAtual = fluxoRaiz;
        this.historico = [];
        this.client = client;
        this.recebeuAtividade = false;
        // Corrigido: armazena a instância do handler, não a classe
        this.geminiHandler = geminiHandler; 
    }

    async enviarAudioSeAtividade() {
        if (this.etapaAtual.type === 'atividade' && this.recebeuAtividade) {
            const proximo = this.encontrarFilho(input);
            if (!proximo) return 'Desculpe, opção inválida. Tente novamente.';

            this.historico.push(this.etapaAtual);
            this.etapaAtual = proximo.proximoPassoValido || proximo;
            this.recebeuAtividade = false;

            // Aqui adiciona o controle se o próximo for um input
            if (this.etapaAtual.type === 'input') {
                return this.etapaAtual.mensagem;
            }

            // Se for outra atividade, envia o áudio
            if (this.etapaAtual.type === 'atividade') {
                return await this.enviarAudioSeAtividade();
            }

            return this.etapaAtual.mensagem;
        }

    }

    async processarEntrada(entrada) {
        const input = entrada.trim();

        // Se chegou numa atividade e ainda não enviou áudio
        if (this.etapaAtual.type === 'atividade' && !this.recebeuAtividade) {
            return await this.enviarAudioSeAtividade();
        }

        // Se é atividade e já enviou áudio, processa a resposta do usuário
        if (this.etapaAtual.type === 'atividade' && this.recebeuAtividade) {
            // Atividade já foi processada automaticamente, só processa entrada normal
            const proximo = this.encontrarFilho(input);
            if (!proximo) return 'Desculpe, opção inválida. Tente novamente.';

            // Ação de voltar
            if (proximo.acao === 'voltar') {
                const anterior = this.historico.pop();
                this.etapaAtual = anterior || this.fluxo;
                this.recebeuAtividade = false;

                if (this.etapaAtual.type === 'atividade') {
                    return await this.enviarAudioSeAtividade();
                }
                return this.etapaAtual.mensagem;
            }

            // Avança para próximo passo
            this.historico.push(this.etapaAtual);
            this.etapaAtual = proximo.proximoPassoValido || proximo;
            this.recebeuAtividade = false;

            // Se próximo passo for atividade
            // if (this.etapaAtual.type === 'atividade') {
            //     return await this.enviarAudioSeAtividade();
            // }

            return this.etapaAtual.mensagem;
        }

        // Para inputs com validação
        if (this.etapaAtual.type === 'input') {
            if (this.etapaAtual.validator) {
                const valido = this.etapaAtual.validator(input);
                if (!valido) return this.etapaAtual.errorMessage;
            }

            this.historico.push(this.etapaAtual);
            this.etapaAtual = this.etapaAtual.filhos;
            this.recebeuAtividade = false;
            return this.etapaAtual.mensagem;
        }


        // Para options com validação - Corrigido type
        if (this.etapaAtual.type === 'options' && this.etapaAtual.validator) {
            const valido = this.etapaAtual.validator(input);
            if (!valido) return this.etapaAtual.errorMessage; // Corrigido: era etapaAtival

            this.historico.push(this.etapaAtual);
            this.etapaAtual = this.etapaAtual.proximoPassoValido;
            this.recebeuAtividade = false;

            // Se próximo passo for atividade
            if (this.etapaAtual.type === 'atividade') {
                 return await this.enviarAudioSeAtividade();
            }

            return this.etapaAtual.mensagem;
        }
        
        // Se próximo passo for IA
        if (this.etapaAtual.type === 'IA') {
            const respostaIA = await this.processarComIA(input);

            const proximo = this.encontrarFilho('1'); // ou alguma lógica de chave
            if (proximo) {
                this.historico.push(this.etapaAtual);
                this.etapaAtual = proximo.proximoPassoValido || proximo;
                this.recebeuAtividade = false;

                // Se próximo passo for atividade
                if (this.etapaAtual.type === 'atividade') {
                    await this.client.sendMessage(this.numero, respostaIA);
                    await this.enviarAudioSeAtividade();
                    return null;
                }

                // Se próximo passo for IA de novo, não precisa aninhar aqui — o próximo `processarEntrada` resolverá
                await this.client.sendMessage(this.numero, respostaIA);
                return this.etapaAtual.mensagem;
            }

            return respostaIA;
        }

        // Para opções normais
        const proximo = this.encontrarFilho(input);
        if (!proximo) return 'Desculpe, opção inválida. Tente novamente.';

        // Ação de voltar
        if (proximo.acao === 'voltar') {
            const anterior = this.historico.pop();
            this.etapaAtual = anterior || this.fluxo;
            this.recebeuAtividade = false;

            if (this.etapaAtual.type === 'atividade') {
                return await this.enviarAudioSeAtividade();
            }
            return this.etapaAtual.mensagem;
        }

        // Avança para próximo passo
        this.historico.push(this.etapaAtual);
        this.etapaAtual = proximo.proximoPassoValido || proximo;
        this.recebeuAtividade = false;

        // Se próximo passo for atividade
        if (this.etapaAtual.type === 'atividade') {
            return await this.enviarAudioSeAtividade();
        }

        return this.etapaAtual.mensagem;
    }

    async processarComIA(entrada) {
        // Verifica se o handler existe
        if (!this.geminiHandler) {
            console.error('❌ GeminiHandler não foi inicializado corretamente');
            return '🤖 Desculpe, há um problema técnico com a IA. Tente novamente mais tarde.';
        }

        try {
            const contexto = {
                identificacao: this.numero,
                nivel: 'Intermediário',
                objetivo: 'Aprender inglês conversando',
                historico: this.historico.map(h => h.titulo || h.mensagem || 'Etapa')?.join(', ')
            };

            // Verifica se o conversationHistory existe
            if (!this.geminiHandler.conversationHistory.has(this.numero)) {
                const contextoInicial = `
            Contexto do usuário:
            - Identificação: ${contexto.identificacao}
            - Nível: ${contexto.nivel}
            - Objetivo: ${contexto.objetivo}
            - Histórico: ${contexto.historico}

            Você é um assistente educacional que responde com base nesse histórico e contexto.
            `;
                this.geminiHandler.updateHistory(this.numero, 'Sistema', contextoInicial);
            }

            // Usa o método processPrompt se existir, senão usa processText
            let resposta;
            if (typeof this.geminiHandler.processPrompt === 'function') {
                resposta = await this.geminiHandler.processPrompt(this.numero, entrada);
            } else if (typeof this.geminiHandler.processText === 'function') {
                resposta = await this.geminiHandler.processText(entrada, this.numero);
            } else {
                throw new Error('Método de processamento não encontrado no GeminiHandler');
            }

            return resposta || '🤖 IA não conseguiu gerar uma resposta no momento.';
        } catch (error) {
            console.error('❌ Erro ao processar com IA:', error.message);
            return '🤖 Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.';
        }
    }

    encontrarFilho(escolha) {
        if (!this.etapaAtual.filhos) return null;
        return this.etapaAtual.filhos.find(f => f.escolha === escolha);
    }
}

module.exports = { SessaoUsuario };

