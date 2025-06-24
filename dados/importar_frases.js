// importar_frases.js
const fs = require('fs');
const openDatabase = require('../db');

async function importar() {
  const db = await openDatabase();
  const frases = JSON.parse(fs.readFileSync('./dados/frases.json', 'utf8'));
  for (const frase of frases) {
    await db.run('INSERT INTO frases_seraphina (frase) VALUES (?)', [frase]);
  }
  await db.close();
  console.log('Frases importadas!');
}
importar();