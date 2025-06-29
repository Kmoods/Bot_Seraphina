const fs = require('fs');
const path = require('path');

// 🔥 Verificar e criar pasta ./temp
const pasta = './temp';
if (!fs.existsSync(pasta)) {
    fs.mkdirSync(pasta);
    console.log('📁 Pasta criada:', pasta);
} else {
    console.log('📁 Pasta já existe:', pasta);
}

// 🔥 Criar JSON de teste
const dados = {
    nome: 'Bot Seraphina',
    horario: '08:00 - Matemática'
};

const nomeArquivo = `./temp/teste-${Date.now()}.json`;

// 🔥 Tentar escrever
try {
    fs.writeFileSync(nomeArquivo, JSON.stringify(dados, null, 2));
    console.log('✅ JSON salvo com sucesso em:', nomeArquivo);
} catch (err) {
    console.error('❌ Erro ao escrever JSON:', err);
}
