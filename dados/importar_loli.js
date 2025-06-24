// importar_loli.js
const fs = require('fs');
const openDatabase = require('../db');

async function importar() {
  const db = await openDatabase();
  const data = JSON.parse(fs.readFileSync('./dados/loli.json', 'utf8'));
  const lolis = data.loli_girl;
  for (const url of lolis) {
    await db.run('INSERT INTO loli_seraphina (url) VALUES (?)', [url]);
  }
  await db.close();
  console.log('Lolis importadas!');
}
importar();