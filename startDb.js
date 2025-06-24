const openDatabase = require('./db');

async function init() {
  const db = await openDatabase();

  // Tabela de usuários
  await db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      chave TEXT NOT NULL,
      plano TEXT NOT NULL,
      limite INTEGER NOT NULL,
      requisicoes INTEGER DEFAULT 0,
      token TEXT NOT NULL
    )
  `);

  // Tabela de imagens
  await db.exec(`
    CREATE TABLE IF NOT EXISTS imagens_seraphina (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL
    )
  `);

  // Tabela de frases
  await db.exec(`
    CREATE TABLE IF NOT EXISTS frases_seraphina (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      frase TEXT NOT NULL
    )
  `);

  // Tabela de vídeos
  await db.exec(`
    CREATE TABLE IF NOT EXISTS videos_seraphina (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL
    )
  `);

await db.exec(`
  CREATE TABLE IF NOT EXISTS loli_seraphina (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL
  )
  `);

await db.exec(`
  CREATE TABLE IF NOT EXISTS foto_seraphina_dev (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL
  )
  `)
  // Adicione outras tabelas aqui conforme for migrando outros JSONs

  await db.close();
}

init();