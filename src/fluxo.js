const fluxo = {
  titulo: 'Início',
  mensagem: "*Welcome, how can I help you?*\n1. Sou Aluno cadastrado\n2. Não sou aluno \n\n _Escreva 'sair' a qualquer momento para encerrar a sessão. ou 'voltar' para voltar ao passo anterior._ ",
  type: 'options',
  filhos: [
    {
      escolha: '1',
      titulo: 'Aluno',
      mensagem: 'Por favor forneça a sua matrícula:',
      type: 'input',
      validator: matricula => /^\d{6,10}$/.test(matricula),
      errorMessage: 'Matrícula inválida. Por favor, insira apenas números com 6 a 10 dígitos.',
      filhos: {
        mensagem: 'Matrícula validada! O que deseja fazer agora?\n1.Corrigir atividades\n2. Praticar pronúncia \n3. Voltar\n4. Sair',
        type: 'options',
        filhos: [
          {
            escolha: '1',
            titulo: 'Corrigir atividades',
            mensagem: 'Você escolheu corrigir atividades. Por favor, envie a atividade que deseja corrigir.',
            type: 'input',
            filhos: {
              mensagem: 'Atividade recebida! O que deseja fazer agora?\n1. Voltar\n2. Sair',
              type: 'options',
              filhos: [
                {
                  escolha: '1',
                  titulo: 'Voltar',
                  acao: 'voltar',
                },
                {
                  escolha: '2',
                  titulo: 'Fim',
                  mensagem: 'Obrigado por usar nosso serviço.',
                  filhos: []
                }
              ]
            }
          },
          {
            escolha: '2',
            titulo: 'Praticar pronúncia',
            mensagem: 'Você escolheu praticar pronúncia. Por favor, envie uma frase para praticar.',
            type: 'input',
            filhos: {
              mensagem: 'Frase recebida! O que deseja fazer agora?\n1. Voltar\n2. Sair',
              type: 'options',
              filhos: [
                {
                  escolha: '1',
                  titulo: 'Voltar',
                  acao: 'voltar',
                },
                {
                  escolha: '2',
                  titulo: 'Fim',
                  mensagem: 'Obrigado por usar nosso serviço.',
                  filhos: []
                }
              ]
            }
          },
          {
            escolha: '3',
            titulo: 'Voltar',
            acao: 'voltar'
          },
          {
            escolha: '4',
            titulo: 'Sair',
            mensagem: 'Obrigado por usar nosso serviço.',
            filhos: []
          }
        ]
      }
    },
    {
      escolha: '2',
      titulo: 'Falar com EllenIA',
      acao: 'conectarIA',
      mensagem: 'Você será conectado à EllenIA, nossa assistente virtual especializada em inglês. Vamos começar avaliando o seu nível de conhecimento. \n\n Digite *Iniciar* para iniciar a primeira pergunta.',
      type: 'IA'
    }
    
  ]
};

module.exports = { fluxo };