const openDatabase = require('../db');
async function carregarPokemons() {
  const db = await openDatabase();
  const pokemons = await db.all('SELECT url FROM pokemon_seraphina');
  await db.close();
  return pokemons;
}
module.exports = { carregarPokemons };