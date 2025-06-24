// importar_pokemon.js
const fs = require('fs');
const openDatabase = require('./db');

async function importar() {
  const db = await openDatabase();
  const data = JSON.parse(fs.readFileSync('./dados/pokemon.json', 'utf8'));
  const imagens = data.Imagens_Seraphina; // ajuste se o campo for diferente
  for (const url of imagens) {
    await db.run('INSERT INTO foto_pokemon_seraphina (url) VALUES (?)', [url]);
  }
  await db.close();
  console.log('Pokémons importados!');
}
importar();