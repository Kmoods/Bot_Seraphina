// importar_videos.js
const fs = require('fs');
const openDatabase = require('../db');

async function importar() {
  const db = await openDatabase();
  const data = JSON.parse(fs.readFileSync('./dados/videos.json', 'utf8'));
  const videos = data.videos;
  for (const url of videos) {
    await db.run('INSERT INTO videos_seraphina (url) VALUES (?)', [url]);
  }
  await db.close();
  console.log('Vídeos importados!');
}
importar();