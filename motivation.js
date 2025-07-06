module.exports = {
  getRandomMotivation: function () {
    const frases = [
      "Acredite no seu potencial!",
      "Cada dia é uma nova chance para ser melhor.",
      "O sucesso é a soma de pequenos esforços repetidos diariamente.",
      "A persistência é o caminho do êxito.",
      "Hoje é o seu dia de brilhar!",
      "Você é mais forte do que pensa.",
      "A determinação de hoje é o sucesso de amanhã.",
      "Transforme seus sonhos em metas.",
      "Não pare até se orgulhar.",
      "O fracasso é apenas a oportunidade de começar de novo com mais experiência.",
      "O que você faz hoje pode melhorar todos os seus amanhãs.",
      "Seus limites são apenas sua imaginação.",
      "A única forma de fazer um excelente trabalho é amar o que você faz.",
      "Viva cada dia como se fosse o último.",
      "Nunca desista dos seus sonhos.",
      "A chave para o sucesso é focar nas metas, não nos obstáculos.",
      "A única pessoa que pode te parar é você mesmo.",
      "Os grandes feitos são conseguidos por aqueles que não têm medo de falhar.",
      "Sonhe grande, trabalhe duro.",
      "A vida é 10% do que acontece e 90% de como você reage.",
      "Cada passo que você dá é uma aproximação do seu objetivo.",
    ];

    return frases[Math.floor(Math.random() * frases.length)];
  },
};
