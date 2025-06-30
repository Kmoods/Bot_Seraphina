/**
 * Módulo do modo Facultativo
 * 
 * Este módulo contém funções específicas para o modo facultativo,
 * incluindo cadastro de membros/grupos, listagem e manipulação de dados.
 * 
 * Todas as operações persistem os dados no arquivo facultativo.json.
 */

const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de dados do modo facultativo
const dataFilePath = path.join(__dirname, 'facultativo.json');

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
 * Função para cadastrar um membro ou grupo no modo facultativo
 * @param {string} id - ID do membro ou grupo
 * @param {object} info - Informações adicionais para cadastro
 * @returns {string} - Mensagem de sucesso ou erro
 */
function cadastrar(id, info) {
  const data = readData();
  const exists = data.find(item => item.id === id);
  if (exists) {
    return 'Este membro/grupo já está cadastrado no modo facultativo.';
  }
  data.push({ id, ...info });
  saveData(data);
  return 'Cadastro realizado com sucesso no modo facultativo.';
}

/**
 * Função para listar os membros/grupos cadastrados no modo facultativo
 * @returns {Array} - Lista de membros/grupos
 */
function listar() {
  return readData();
}

/**
 * Outras funções específicas do modo facultativo podem ser adicionadas aqui
 */

module.exports = {
  cadastrar,
  listar,
};
