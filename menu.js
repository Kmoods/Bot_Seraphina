function menu(prefix, modo) {
  switch (modo) {
    case "empresarial":
      return `💼 *Painel Empresarial*:

📋 ${prefix}tarefas – Ver lista de tarefas

🎵 ${prefix}musica – Tocar música ambiente corporativa

✅ ${prefix}feito ID – Marcar tarefa como concluída

`;

    case "escolar":
      return `🏫 *Menu Escolar*:

📝 ${prefix}add-tarefa – Adicionar nova tarefa

📚 ${prefix}tarefas – Ver tarefas escolares

✅ ${prefix}feito ID – Marcar tarefa como feita

🧠 ${prefix}auto-lembr – Ativar lembrete automático de estudos

⏰ ${prefix}add-lembrete – Adicionar lembrete

📅 ${prefix}lembretes – Ver lembretes agendados

❌ ${prefix}del-lembrete ID – Excluir lembrete

❌ ${prefix}del-tarefa ID – Excluir tarefa

🔒 ${prefix}restrito on/off – Ativar/desativar modo só ADM pode adicionar/excluir tarefas e lembretes

🎧 ${prefix}play – Use desse jeito: EX: ${prefix}play alok

`;//Arrumar alguns modos aqui!

    case "amizade":
      return `💖 *Menu Amizade*:

📝 ${prefix}tarefas – Ver tarefas compartilhadas

🎶 ${prefix}musica – Tocar playlist para relaxar e curtir

✅ ${prefix}feito ID – Marcar tarefa como feita

`;

    case "facultativo":
      return `🌀 *Menu Personalizado*:

📋 ${prefix}tarefas – Ver suas tarefas

🎵 ${prefix}musica – Tocar trilha motivacional

✅ ${prefix}feito ID – Marcar tarefa como concluída

`;

    default:
      return `⚠️ *Modo não definido!*
Use o comando:
${prefix}modo [*1*: empresarial | *2*: escolar | *3*: amizade | *4*: facultativo]
Para configurar o menu de acordo com sua necessidade.`;
  }
}

// Personalizar os menus
module.exports = { menu };
