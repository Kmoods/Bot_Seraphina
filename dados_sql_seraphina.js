const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database/bot.db');

// Tarefas
exports.listarTarefas = function(callback) {
  db.all('SELECT * FROM tarefas', [], (err, rows) => {
    if (err) return callback("Erro ao acessar o banco de dados.");
    callback(rows);
  });
};

exports.adicionarTarefa = function(descricao, dataEntrega, callback) {
  db.run(
    'INSERT INTO tarefas (descricao, data, entregar, feita) VALUES (?, ?, ?, 0)',
    [descricao, new Date().toLocaleDateString("pt-BR"), dataEntrega],
    function (err) {
      if (err) return callback("Erro ao adicionar tarefa.");
      callback(`Tarefa adicionada: ${descricao} (Entrega: ${dataEntrega})`);
    }
  );
};

exports.marcarTarefaComoFeita = function(id, callback) {
  db.run('UPDATE tarefas SET feita = 1 WHERE id = ?', [id], function (err) {
    if (err) return callback("Erro ao marcar tarefa como feita.");
    callback(`Tarefa #${id} marcada como feita.`);
  });
};

// Lembretes
exports.listarLembretes = function(from, callback) {
  db.all('SELECT * FROM lembretes WHERE local = ?', [from], (err, rows) => {
    if (err) return callback("Erro ao acessar o banco de dados.");
    callback(rows);
  });
};

exports.adicionarLembrete = function(from, descricao, tipo, frequencia, data, hora, callback) {
  db.run(
    'INSERT INTO lembretes (descricao, local, tipo, frequencia, ultimaExecucao, data, hora, dataCriacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [descricao, from, tipo, frequencia, null, data, hora, new Date().toISOString().split("T")[0]],
    function (err) {
      if (err) return callback("Erro ao adicionar lembrete.");
      callback(`✅ Lembrete adicionado!\n\n📝 *${descricao}*\n🆔 *ID:* ${this.lastID}`);
    }
  );
};

exports.excluirLembretes = function(from, ids, callback) {
  const idsArray = ids
    .split(/[\s,]+/)
    .map((id) => parseInt(id))
    .filter((id) => !isNaN(id));
  if (!idsArray.length) return callback("❌ Nenhum ID válido informado.");
  let removidos = 0;
  idsArray.forEach((id, idx) => {
    db.run('DELETE FROM lembretes WHERE id = ? AND local = ?', [id, from], function (err) {
      if (!err && this.changes > 0) removidos++;
      if (idx === idsArray.length - 1) {
        if (removidos === 0) callback("⚠️ Nenhum lembrete encontrado com esses IDs neste grupo.");
        else callback(`🗑️ *Lembretes excluídos:* ${idsArray.join(", ")}`);
      }
    });
  });
};

// Grupos
exports.getModoGrupo = function(grupoId, callback) {
  db.get('SELECT modo FROM grupos WHERE id = ?', [grupoId], (err, row) => {
    if (err || !row) return callback(null);
    callback(row.modo);
  });
};

exports.setModoGrupo = function(grupoId, nome, modo, callback) {
  db.run(
    'INSERT OR REPLACE INTO grupos (id, nome, modo) VALUES (?, ?, ?)',
    [grupoId, nome, modo],
    function (err) {
      if (err) return callback(false);
      callback(true);
    }
  );
};

exports.grupoCadastrado = function(grupoId, callback) {
  db.get('SELECT id FROM grupos WHERE id = ?', [grupoId], (err, row) => {
    callback(!!row);
  });
};

// Funções gerais (exemplo: autoLembrAtivo)
exports.lerFuncoes = function(callback) {
  db.get('SELECT autoLembrAtivo FROM funcoes', [], (err, row) => {
    if (err || !row) return callback({ autoLembrAtivo: false });
    callback({ autoLembrAtivo: !!row.autoLembrAtivo });
  });
};

exports.salvarFuncoes = function(autoLembrAtivo, callback) {
  db.run('UPDATE funcoes SET autoLembrAtivo = ?', [autoLembrAtivo ? 1 : 0], function (err) {
    if (callback) callback(!err);
  });
};