const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database/bot.db');

db.serialize(() => {
  // Tabela de tarefas
  db.run(`CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT,
    data TEXT,
    entregar TEXT,
    feita INTEGER
  )`);

  // Tabela de lembretes
  db.run(`CREATE TABLE IF NOT EXISTS lembretes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT,
    local TEXT,
    tipo TEXT,
    frequencia INTEGER,
    ultimaExecucao TEXT,
    data TEXT,
    hora TEXT,
    dataCriacao TEXT
  )`);

  // Tabela de grupos
  db.run(`CREATE TABLE IF NOT EXISTS grupos (
    id TEXT PRIMARY KEY,
    nome TEXT,
    modo TEXT
  )`);

  // Tabela de funções gerais
  db.run(`CREATE TABLE IF NOT EXISTS funcoes (
    autoLembrAtivo INTEGER
  )`);

  // Insere linha padrão na tabela funcoes, se não existir
  db.get('SELECT COUNT(*) as total FROM funcoes', (err, row) => {
    if (row.total === 0) {
      db.run('INSERT INTO funcoes (autoLembrAtivo) VALUES (0)', () => {
        console.log("Banco de dados criado/configurado com sucesso!");
        db.close();
      });
    } else {
      console.log("Banco de dados criado/configurado com sucesso!");
      db.close();
    }
  });
});