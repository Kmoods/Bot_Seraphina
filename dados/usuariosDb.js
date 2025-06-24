const openDatabase = require('../db');

async function carregarUsuarios() {
  const db = await openDatabase();
  const usuarios = await db.all('SELECT * FROM usuarios');
  await db.close();
  return usuarios;
}

async function salvarUsuario(usuario) {
  const db = await openDatabase();
  const existe = await db.get('SELECT id FROM usuarios WHERE token = ?', [usuario.token]);
  if (existe) {
    await db.run(
      'UPDATE usuarios SET numero=?, chave=?, plano=?, limite=?, requisicoes=? WHERE token=?',
      [usuario.numero, usuario.chave, usuario.plano, usuario.limite, usuario.requisicoes, usuario.token]
    );
  } else {
    await db.run(
      'INSERT INTO usuarios (numero, chave, plano, limite, requisicoes, token) VALUES (?, ?, ?, ?, ?, ?)',
      [usuario.numero, usuario.chave, usuario.plano, usuario.limite, usuario.requisicoes, usuario.token]
    );
  }
  await db.close();
}

async function deletarUsuarioPorChave(chave) {
  const db = await openDatabase();
  await db.run('DELETE FROM usuarios WHERE chave = ?', [chave]);
  await db.close();
}

async function buscarUsuarioPorChave(chave) {
  const db = await openDatabase();
  const usuario = await db.get('SELECT * FROM usuarios WHERE chave = ?', [chave]);
  await db.close();
  return usuario;
}

module.exports = {
  carregarUsuarios,
  salvarUsuario,
  deletarUsuarioPorChave,
  buscarUsuarioPorChave
};