function menu(prefix, modo) {
  switch (modo) {
    case "empresarial":
     return `💼 *Painel Empresarial – Seraphina Bot*

🏢 *Gestão da Empresa*
├─ 🆕 ${prefix}cadastrar-empresa [nome]
├─ 📊 ${prefix}dashboard – Visão geral da empresa (com gráfico)

📈 *Finanças*
├─ 💰 ${prefix}receita valor / descrição
├─ 🧾 ${prefix}despesa valor descrição
├─ 🎯 ${prefix}meta valor – Definir meta mensal
├─ 💸 ${prefix}venda preduto quantidade

📦 *Controle de Estoque*
├─ 📋 ${prefix}estoque – Ver itens no estoque
└─ ➕ ${prefix}add-estoque nome quantidade precoVenda precoCompra – Adicionar produto ao estoque

📤 *Exportações*
├─ 📊 ${prefix}exportar-excel – Excel (.xlsx)
└─ 🧾 ${prefix}exportar-pdf – PDF resumido

🗂️ *Produtividade*
├─ 📋 ${prefix}tarefas – Listar tarefas
└─ ✅ ${prefix}feito ID – Marcar tarefa concluída

🎵 *Ambiente*
└─ 🎶 ${prefix}musica – Tocar música ambiente

👤 *Sobre*
└─ 👨‍💻 ${prefix}criado – Informações do criador`;

    case "escolar":
      return `
╭━━━ 🎓 *Menu Escolar Seraphina* 🎓 ━━━╮

📚 *Tarefas & Estudos*
├─ 📝 *Adicionar tarefa:* ${prefix}add-tarefa
├─ 📚 *Ver tarefas:* ${prefix}tarefas
├─ ✅ *Marcar como feita:* ${prefix}feito ID
├─ ❌ *Excluir tarefa:* ${prefix}del-tarefa ID

⏰ *Lembretes & Rotina*
├─ 🧠 *Ativar auto-lembrete:* ${prefix}auto-lembr on/off
├─ ⏰ *Adicionar lembrete:* ${prefix}add-lembrete
├─ 📅 *Ver lembretes:* ${prefix}lembretes
├─ ❌ *Excluir lembrete:* ${prefix}del-lembrete ID

🔒 *Administração*
├─ 🔒 *Modo restrito (só ADM):* ${prefix}restrito on/off
├─ 🏷️ *Definir modo do grupo:* ${prefix}modo 2

🎧 *Diversão & Ajuda*
├─ 🎵 *Tocar música de estudo (Spotify):* ${prefix}play-spoti
├─ 🎧 *Play YouTube:* ${prefix}play nome-da-música *(temporariamente inativo)*
├─ 🤖 *Pergunte à IA:* ${prefix}chat sua pergunta *(temporariamente inativo)*
├─ 👤 *Criador:* ${prefix}criador

╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

*Dicas:*
- O comando *play-spoti* utiliza o Spotify.
- O comando *play* utiliza o YouTube, mas está temporariamente inativo.
- Use sempre o prefixo "${prefix}" antes dos comandos.
- Para ver este menu novamente, envie: ${prefix}menu
- Marque tarefas como feitas para manter sua organização!
`;

    case "amizade":
      return `💖 *Menu Amizade*:

📝 ${prefix}tarefas – Ver tarefas compartilhadas
🎶 ${prefix}musica – Tocar playlist para relaxar e curtir
✅ ${prefix}feito ID – Marcar tarefa como feita
🖼️ *Mudar foto do grupo:* ${prefix}fotogp
Fazer figurinha: ${prefix}s [marque a imagem] - *Faz figurinhas de imagens enviadas*
nomear grupo: ${prefix}nomegp [novo nome] - *Muda o nome do grupo*
👤 *Criador:* ${prefix}criado

`;

    case "facultativo":
      return `🌀 *Menu Personalizado*:

📋 ${prefix}tarefas – Ver suas tarefas
🎵 ${prefix}musica – Tocar trilha motivacional
✅ ${prefix}feito ID – Marcar tarefa como concluída
👤 *Criador:* ${prefix}criado
`;

    default:
      return `⚠️ *Modo não definido!*
Use o comando:
${prefix}modo [*1*: empresarial | *2*: escolar | *3*: amizade | *4*: facultativo]
Para configurar o menu de acordo com sua necessidade.`;
  }
}

module.exports = { menu };
