// importar_imagens.js
const fs = require('fs');
const openDatabase = require('./db');

async function importar() {
  const db = await openDatabase();
  const data = JSON.parse(fs.readFileSync('./dados/imagens.json', 'utf8'));
  const imagens = data.Imagens_Seraphina;
  for (const url of imagens) {
    await db.run('INSERT INTO imagens_seraphina (url) VALUES (?)', [url]);
  }
  await db.close();
  console.log('Imagens importadas!');
}
importar();