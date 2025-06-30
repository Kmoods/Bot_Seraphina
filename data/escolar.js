/**
 * Módulo do modo Escolar
 * 
 * Este módulo contém funções específicas para o modo escolar,
 * incluindo cadastro de membros/grupos, listagem e manipulação de dados.
 * 
 * Todas as operações persistem os dados no arquivo escolar.json.
 */

const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de dados do modo escolar
const dataFilePath = path.join(__dirname, 'escolar.json');

// Função para ler os dados do arquivo JSON
function readData() {
  try {
    const data = fs.readFileSync(dataFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Se o arquivo não existir ou estiver vazio, retorna um array vazio
    return [];
  }
}

// Função para salvar os dados no arquivo JSON
function saveData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

/**
 * Função para cadastrar um membro ou grupo no modo escolar
 * @param {string} id - ID do membro ou grupo
 * @param {object} info - Informações adicionais para cadastro
 * @returns {string} - Mensagem de sucesso ou erro
 */
function cadastrar(id, info) {
  const data = readData();
  const exists = data.find(item => item.id === id);
  if (exists) {
    return 'Este membro/grupo já está cadastrado no modo escolar.';
  }
  data.push({ id, ...info });
  saveData(data);
  return 'Cadastro realizado com sucesso no modo escolar.';
}

/**
 * Função para listar os membros/grupos cadastrados no modo escolar
 * @returns {Array} - Lista de membros/grupos
 */
function listar() {
  return readData();
}

/**
 * Função para buscar um membro ou grupo pelo ID
 * @param {string} id - ID do membro ou grupo a ser buscado
 * @returns {object|null} - Retorna o membro/grupo encontrado ou null
 */
function buscarPorId(id) {
  const data = readData();
  return data.find(item => item.id === id) || null;
}

/**
 * Função para atualizar as informações de um membro ou grupo
 * @param {string} id - ID do membro ou grupo a ser atualizado
 * @param {object} novasInfo - Novas informações para atualizar
 * @returns {string} - Mensagem de sucesso ou erro
 */
function atualizar(id, novasInfo) {
  const data = readData();
  const index = data.findIndex(item => item.id === id);
  if (index === -1) {
    return 'Membro/grupo não encontrado no modo escolar.';
  }
  data[index] = { id, ...novasInfo };
  saveData(data);
  return 'Cadastro atualizado com sucesso no modo escolar.';
}

/**
 * Função para remover um membro ou grupo do modo escolar
 * @param {string} id - ID do membro ou grupo a ser removido
 * @returns {string} - Mensagem de sucesso ou erro
 */
function remover(id) {
  let data = readData();
  const index = data.findIndex(item => item.id === id);
  if (index === -1) {
    return 'Membro/grupo não encontrado no modo escolar.';
  }
  data = data.filter(item => item.id !== id);
  saveData(data);
  return 'Membro/grupo removido com sucesso do modo escolar.';
}

/**
 * Outras funções específicas do modo escolar podem ser adicionadas aqui
 */

module.exports = {
  cadastrar,
  listar,
  buscarPorId,
  atualizar,
  remover,
};

