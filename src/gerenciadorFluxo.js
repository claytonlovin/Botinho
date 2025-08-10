const { fluxo } = require('./fluxo.js');
const { SessaoUsuario } = require('./SessaoUsuario.js');

class GerenciadorSessoes {
  constructor() {
    this.sessoes = {};
  }

  async processarEntrada(numero, entrada, client, geminiHandler) {
  if (!this.sessoes[numero]) {
    this.sessoes[numero] = new SessaoUsuario(numero, fluxo, client, geminiHandler);
    try {
      return await client.sendMessage(numero, fluxo.mensagem);

      } catch (err) {
        console.error('Erro ao processar entrada:', err.message);
        return '⚠️ Ocorreu um erro ao processar sua mensagem. Tente novamente mais tarde.';
      }

  }

  return await this.sessoes[numero].processarEntrada(entrada);
}
   getSessao(numero) {
    return this.sessoes[numero];
  }

  removerSessao(numero) {
    delete this.sessoes[numero];
  }
}

const gerenciadorSessoes = new GerenciadorSessoes();

module.exports = { GerenciadorSessoes, gerenciadorSessoes };