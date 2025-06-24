// importar_foto_dev.js
const fs = require('fs');
const openDatabase = require('../db');

async function importar() {
  const db = await openDatabase();
  const data = JSON.parse(fs.readFileSync('./dados/fotodev.json', 'utf8'));
  const fotos = data.fotodev;
  for (const url of fotos) {
    await db.run('INSERT INTO foto_seraphina_dev (url) VALUES (?)', [url]);
  }
  await db.close();
  console.log('Fotos Dev importadas!');
}
importar();