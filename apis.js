require('dotenv').config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const search = require("yt-search");
const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const router = express.Router();
const { carregarPokemons } = require('./dados/pokemonDb');


const {
  carregarUsuarios,
  salvarUsuario,
  deletarUsuarioPorChave,
  buscarUsuarioPorChave
} = require('./dados/usuariosDb');

const semkeyPath = path.join(__dirname, "public", "semkey.html");

let apikeys = [];
async function atualizarApiKeys() {
  const usuarios = await carregarUsuarios();
  apikeys = usuarios.map((u) => u.chave);
}
atualizarApiKeys();

// Atualiza limite por chave
async function atualizarLimitePorChave(chave) {
  const usuario = await buscarUsuarioPorChave(chave);
  if (!usuario) {
    return { sucesso: false, mensagem: "Chave não encontrada." };
  }
  if (usuario.requisicoes >= usuario.limite) {
    return { sucesso: false, mensagem: "Limite de requisições excedido." };
  }
  usuario.requisicoes += 1;
  await salvarUsuario(usuario);
  let requisicoes_retante = usuario.limite - usuario.requisicoes;
  return { sucesso: true, restante: requisicoes_retante };
}

// Middleware para verificação de API Key
async function verificarKey(req, res, next) {
  const key = req.query.apikey;
  if (!key) {
    return res.status(403).sendFile(semkeyPath);
  }
  const usuario = await buscarUsuarioPorChave(key);
  if (!usuario) {
    return res.status(403).json({ error: "API Key inválida." });
  }
  if (usuario.plano !== "gratuito" && usuario.requisicoes >= usuario.limite) {
    return res.status(429).json({ error: "Limite de requisições atingido." });
  }
  usuario.requisicoes = (usuario.requisicoes || 0) + 1;
  await salvarUsuario(usuario);
  req.usuario = usuario;
  next();
}

// Reset diário programado para 00:00
async function resetarRequisicoes() {
  const usuarios = await carregarUsuarios();
  for (const u of usuarios) {
    u.requisicoes = 0;
    await salvarUsuario(u);
  }
  await atualizarApiKeys();
  console.log("🔄 Limites de requisição resetados às 00:00.");
}

function agendarResetDiario() {
  const agora = new Date();
  const proximoReset = new Date();
  proximoReset.setHours(24, 0, 0, 0); // meia-noite
  const tempoRestante = proximoReset - agora;
  setTimeout(() => {
    resetarRequisicoes();
    setInterval(resetarRequisicoes, 24 * 60 * 60 * 1000);
  }, tempoRestante);
}
agendarResetDiario();

const SENHA_ADMIN = "2008Kmods"; // Substitua pela sua senha

router.get("/api/verificar-senha", (req, res) => {
  const senha = req.query.senha;
  if (!senha) {
    return res.status(400).json({ autorizado: false, erro: "Senha não fornecida" });
  }
  if (senha === SENHA_ADMIN) {
    return res.json({ autorizado: true });
  } else {
    return res.json({ autorizado: false });
  }
});

// Endpoint de verificação de chave
router.post("/api/validar-chave", async (req, res) => {
  const { numero, chave } = req.body;
  if (!numero || !chave) {
    return res
      .status(400)
      .json({ message: "Número e chave são obrigatórios." });
  }
  const usuario = await buscarUsuarioPorChave(chave);
  if (!usuario || usuario.numero !== numero) {
    return res
      .status(403)
      .json({ message: "Chave inválida ou usuário não encontrado." });
  }
  if (!usuario.requisicoes) usuario.requisicoes = 0;
  const limite = usuario.limite || 0;
  if (usuario.requisicoes === limite) {
    return res
      .status(429)
      .json({ message: "Limite de requisições atingido. Atualize seu plano." });
  }
  usuario.requisicoes += 1;
  await salvarUsuario(usuario);
  return res.status(200).json({
    message: "Chave válida.",
    plano: usuario.plano,
    limite,
    usadas: usuario.requisicoes,
  });
});

router.post("/api/save-user", async (req, res) => {
  const { numero, chave, plano, limite, token } = req.body;
  if (!numero || !chave || !plano || !limite) {
    return res.status(400).json({ message: "Dados incompletos." });
  }
  let usuario = {
    numero, chave, plano, limite, requisicoes: 0, token: token || "token_" + Math.random().toString(36).substring(2, 15)
  };
  await salvarUsuario(usuario);
  await atualizarApiKeys();
  return res.json({
    message: "Usuário salvo com sucesso.",
    token: usuario.token,
  });
});

// GET /api/user-info
router.get("/api/user-info", async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ message: "Token é obrigatório." });
  }
  const usuarios = await carregarUsuarios();
  const usuario = usuarios.find((u) => u.token === token);
  if (!usuario) {
    return res
      .status(404)
      .json({ message: "Usuário não encontrado para esse token." });
  }
  res.json({
    numero: usuario.numero,
    chave: usuario.chave,
    plano: usuario.plano,
    limite: usuario.limite,
    requisicoes: usuario.requisicoes || 0,
  });
});

let audioDownloads = {}; // Armazenar o estado dos downloads

// Função para gerar CPF aleatório
function gerarCPF() {
  let n = "";
  for (let i = 0; i < 9; i++) {
    n += Math.floor(Math.random() * 10);
  }
  const cpf = n.split("");
  let v1 = 0;
  let v2 = 0;
  for (let i = 0; i < 9; i++) {
    v1 += cpf[i] * (10 - i);
    v2 += cpf[i] * (11 - i);
  }
  v1 = v1 % 11 < 2 ? 0 : 11 - (v1 % 11);
  cpf.push(v1);
  v2 += v1 * 2;
  v2 = v2 % 11 < 2 ? 0 : 11 - (v2 % 11);
  cpf.push(v2);
  return cpf.join("");
}

// --- Suas rotas de API que usam arquivos JSON para imagens, frases, etc, permanecem iguais ---

// Exemplo de rota protegida por apikey usando banco:
const API_SECRET = process.env.API_SECRET || "@$@##*&!KMODS2025!@#@001a" ; // MESMA chave do Python!
const ultimasRequisicoes = {}; // cooldown por apikey

router.get("/api/playAudio", async (req, res) => {
  const apikey = req.query.apikey;
  const videoUrl = req.query.url;

  // 🔐 Verifica API Key
  const usuario = await buscarUsuarioPorChave(apikey);
  if (!apikey || !usuario) {
    return res.status(403).json({ error: "API Key inválida ou não fornecida." });
  }

  // ⏱️ Cooldown de 1 minuto
  const agora = Date.now();
  const ultima = ultimasRequisicoes[apikey] || 0;
  if (agora - ultima < 60000) {
    const tempoRestante = Math.ceil((60000 - (agora - ultima)) / 1000);
    return res.status(429).json({ error: `Aguarde ${tempoRestante} segundos para nova requisição.` });
  }
  ultimasRequisicoes[apikey] = agora;

  // 📊 Verifica limite
  const resultado = await atualizarLimitePorChave(apikey);
  if (!resultado.sucesso) {
    return res.status(403).json({ error: resultado.mensagem });
  }

  // 🎥 Verifica URL
  if (!videoUrl) {
    return res.status(400).json({ error: "É necessário fornecer a URL do vídeo." });
  }

  try {
    console.log("🎵 Baixando áudio de:", videoUrl);

    // Chama o microserviço Python
    const response = await axios.post(
      "https://youtube-python-seraphinaapi.onrender.com/baixar-audio",
      { url: videoUrl },
      {
        responseType: "stream",
        headers: {
          "X-API-SECRET": API_SECRET
        }
      }
    );

    res.setHeader("Content-Disposition", 'attachment; filename="audio.mp3"');
    res.setHeader("Content-Type", "audio/mpeg");
    response.data.pipe(res);

  } catch (error) {
    console.error("❌ Erro ao baixar áudio via Python:", error.message);
    return res.status(500).json({ error: "Erro ao processar o áudio." });
  }
});



// Rota para consulta de CEP
router.get("/api/consulta/cep/:cep", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    const cep = req.params.cep;
    if (!cep) return res.json({ erro: "Digite o CEP no parâmetro da URL" });

    try {
      const response = await axios.get(
        `https://brasilapi.com.br/api/cep/v1/${cep}`
      );
      const data = response.data;

      const { state, city, neighborhood, street } = data;

      res.json({
        criador: "Kmods",
        cep: cep,
        estado: state,
        cidade: city,
        vizinhança: neighborhood,
        rua: street,
        serviço: "open-cep",
      });
    } catch (error) {
      console.error("Erro ao consultar API de CEP:", error.message);
      res
        .status(error.response?.status || 500)
        .json({ error: "Erro ao consultar API de CEP" });
    }
  } else {
    res.sendFile(semkeyPath);
  }
});

// Rota para consulta de cidades por DDD
router.get("/api/consulta/ddd/:ddd", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    const ddd = req.params.ddd;
    if (!ddd) return res.json({ erro: "digite o ddd no parâmetro da url" });

    try {
      const response = await axios.get(
        `https://brasilapi.com.br/api/ddd/v1/${ddd}`
      );
      const data = response.data;

      // Mapeia o estado associado ao DDD consultado
      const state = data.state;

      // Lista de cidades associadas ao DDD
      const cities = data.cities;

      res.json({
        criador: "Kmods",
        state: state,
        cities: cities,
      });
    } catch (error) {
      console.error("Erro ao consultar API de DDD:", error.message);
      res
        .status(error.response?.status || 500)
        .json({ error: "Erro ao consultar API de DDD" });
    }
  } else {
    res.sendFile(semkeyPath);
  }
});

// Rota para consulta de dados climáticos por aeroporto
router.get("/api/consulta/clima/aeroporto/:codigoICAO", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    const codigoICAO = req.params.codigoICAO;

    try {
      const response = await axios.get(
        `https://brasilapi.com.br/api/cptec/v1/clima/aeroporto/${codigoICAO}`
      );
      const data = response.data;

      // Extrai os dados conforme especificado
      const {
        umidade,
        visibilidade,
        codigo_icao,
        pressao_atmosferica,
        vento,
        direcao_vento,
        condicao,
        condicao_desc,
        temp,
        atualizado_em,
      } = data;

      // Formata os dados conforme o modelo desejado
      const formattedData = {
        criador: "Kmods",
        umidade: umidade,
        visibilidade: visibilidade,
        codigo_icao: codigo_icao,
        pressao_atmosferica: pressao_atmosferica,
        vento: vento,
        direcao_vento: direcao_vento,
        condicao: condicao,
        condicao_desc: condicao_desc,
        temp: temp,
        atualizado_em: atualizado_em,
      };

      res.json(formattedData);
    } catch (error) {
      console.error(
        "Erro ao consultar API de dados climáticos:",
        error.message
      );
      res
        .status(error.response?.status || 500)
        .json({ error: "Erro ao consultar API de dados climáticos" });
    }
  } else {
    res.sendFile(semkeyPath);
  }
});

// Rota para obter um GIF aleatório
// Exemplo de rota para vídeo aleatório (SQLite)
router.get("/api/video-aleatorio", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys.includes(apikey)) return res.sendFile(semkeyPath);

  try {
    const videos = await carregarVideos();
    if (!videos.length) return res.status(404).send("Nenhum vídeo encontrado");
    const randomVideoUrl = videos[Math.floor(Math.random() * videos.length)].url;
    const response = await axios.get(randomVideoUrl, { responseType: "arraybuffer" });
    res.set("Content-Type", "video/mp4");
    res.send(Buffer.from(response.data, "binary"));
  } catch (error) {
    console.error("Erro ao obter vídeo aleatório:", error);
    res.status(500).send("Erro ao obter vídeo aleatório");
  }
});

// Exemplo de rota para loli aleatória (SQLite)
router.get("/api/loli-aleatoria", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys.includes(apikey)) return res.sendFile(semkeyPath);

  try {
    const lolis = await carregarLolis();
    if (!lolis.length) return res.status(404).send("Nenhuma loli encontrada");
    const loliAleatoria = lolis[Math.floor(Math.random() * lolis.length)].url;
    const response = await axios.get(loliAleatoria, { responseType: "arraybuffer" });
    res.set("Content-Type", "image/jpeg");
    res.send(Buffer.from(response.data, "binary"));
  } catch (error) {
    console.error("Erro ao obter loli aleatória:", error);
    res.status(500).send("Erro ao obter loli aleatória");
  }
});
router.get("/api/dados-pessoais", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    try {
      const response = await axios.get("https://randomuser.me/api/");
      const userData = response.data.results[0];

      const personalData = {
        nomeCompleto: `${userData.name.first} ${userData.name.last}`,
        idade: userData.dob.age,
        cpf: userData.login.uuid.substring(0, 14),
        email: userData.email,
        telefone: userData.phone,
        cidade: userData.location.city,
        estado: userData.location.state,
        cep: userData.location.postcode,
        endereco: `${userData.location.street.name}, ${userData.location.street.number}`,
        foto: userData.picture.large,
      };

      res.json({ criador: "Kmods", resultado: personalData });
    } catch (error) {
      console.error("Erro ao obter dados do usuário:", error);
      res.status(500).json({ error: "Erro ao obter dados do usuário" });
    }
  } else {
    res.sendFile(semkeyPath);
  }
});

// Rota para gerar CPF aleatório
router.get("/api/gerar-cpf", (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    const cpf = gerarCPF();
    res.json({ criador: "Kmods", cpf: cpf });
  } else {
    res.sendFile(semkeyPath);
  }
});

// Rota para gerar frase aleatória
// Exemplo de rota para frase aleatória (SQLite)
router.get("/api/frase-aleatoria", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys.includes(apikey)) return res.sendFile(semkeyPath);

  try {
    const frases = await carregarFrases();
    if (!frases.length) return res.status(404).send("Nenhuma frase encontrada");
    const fraseAleatoria = frases[Math.floor(Math.random() * frases.length)].frase;
    res.json({ criador: "Kmods", frase: fraseAleatoria });
  } catch (error) {
    console.error("Erro ao obter frase aleatória:", error);
    res.status(500).json({ error: "Erro ao obter frase aleatória" });
  }
});

// Rota para obter imagem aleatória do arquivo JSON local
router.get("/api/imagem-aleatoria", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys.includes(apikey)) return res.sendFile(semkeyPath);

  try {
    const imagens = await carregarImagens();
    if (!imagens.length) return res.status(404).send("Nenhuma imagem encontrada");
    const imagemAleatoria = imagens[Math.floor(Math.random() * imagens.length)].url;
    const response = await axios.get(imagemAleatoria, { responseType: "arraybuffer" });
    res.set("Content-Type", "image/jpeg");
    res.send(Buffer.from(response.data, "binary"));
  } catch (error) {
    console.error("Erro ao obter imagem aleatória:", error);
    res.status(500).send("Erro ao obter imagem aleatória");
  }
});

// Rota para obter imagem aleatória do arquivo JSON local
router.get("/api/imagem-dev", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys.includes(apikey)) return res.sendFile(semkeyPath);

  try {
    const fotos = await carregarFotosDev();
    if (!fotos.length) return res.status(404).send("Nenhuma foto encontrada");
    const fotoAleatoria = fotos[Math.floor(Math.random() * fotos.length)].url;
    const response = await axios.get(fotoAleatoria, { responseType: "arraybuffer" });
    res.set("Content-Type", "image/jpeg");
    res.send(Buffer.from(response.data, "binary"));
  } catch (error) {
    console.error("Erro ao obter foto dev aleatória:", error);
    res.status(500).send("Erro ao obter foto dev aleatória");
  }
});

// Rota para obter imagem aleatória do arquivo JSON local
router.get("/api/imagem-pokemon", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys.includes(apikey)) return res.sendFile(semkeyPath);

  try {
    const pokemons = await carregarPokemons();
    if (!pokemons.length) return res.status(404).send("Nenhuma imagem encontrada");
    const imagemAleatoria = pokemons[Math.floor(Math.random() * pokemons.length)].url;
    const response = await axios.get(imagemAleatoria, { responseType: "arraybuffer" });
    res.set("Content-Type", "image/jpeg");
    res.send(Buffer.from(response.data, "binary"));
  } catch (error) {
    console.error("Erro ao obter imagem aleatória:", error);
    res.status(500).send("Erro ao obter imagem aleatória");
  }
});

// GET - Lista todos os usuários
router.get("/api/usuarios", async (req, res) => {
  const usuarios = await carregarUsuarios();
  res.json(usuarios);
});


// DELETE - Remove usuário por chave
router.delete("/api/deletar-usuario", async (req, res) => {
  const { chave } = req.query;
  if (!chave) {
    return res.status(400).json({ message: "Chave do usuário não fornecida." });
  }
  const usuario = await buscarUsuarioPorChave(chave);
  if (!usuario) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }
  await deletarUsuarioPorChave(chave);
  res.json({ message: "Usuário deletado com sucesso." });
});

router.get("/api/verificar-usuario", async (req, res) => {
  const { numero } = req.query;
  const usuarios = await carregarUsuarios();
  const existe = usuarios.some((u) => u.numero === numero);
  res.json({ existe });
});


// PUT - Edita usuário (atualiza plano)
router.put("/api/editar-usuario", async (req, res) => {
  const { numero, plano } = req.body;
  if (!numero || !plano) {
    return res
      .status(400)
      .json({ message: "Número e plano são obrigatórios." });
  }
  const usuarios = await carregarUsuarios();
  const usuario = usuarios.find((u) => u.numero === numero);
  if (!usuario) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }
  usuario.plano = plano;
  await salvarUsuario(usuario);
  return res.json({ message: "Plano alterado com sucesso." });
});

// PUT - alterar plano do usuário
router.put("/api/alterar-plano", async (req, res) => {
  const { chave, plano } = req.body;
  const usuario = await buscarUsuarioPorChave(chave);
  if (!usuario) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }
  usuario.plano = plano;
  // Define limite automaticamente conforme plano
  const limitesPorPlano = {
    gratuito: 100,
    plus: 2050,
    premium: 10000,
  };
  usuario.limite = limitesPorPlano[plano] || 100;
  await salvarUsuario(usuario);
  res.json({
    message: "Plano e limite alterados com sucesso.",
    limite: usuario.limite,
  });
});

router.get("/api/status", async (req, res) => {
  const start = Date.now();
  const memoryUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const usuarios = await carregarUsuarios();
  const totalUsers = usuarios.length;
  const ping = Date.now() - start;
  res.json({
    ping: ping + " ms",
    memoryUsage: {
      rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + " MB",
      heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + " MB",
      heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + " MB",
      external: (memoryUsage.external / 1024 / 1024).toFixed(2) + " MB",
    },
    ramUsage: {
      used: (usedMem / 1024 / 1024).toFixed(2) + " MB",
      total: (totalMem / 1024 / 1024).toFixed(2) + " MB",
    },
    totalUsers: totalUsers,
    updatedAt: new Date().toISOString(),
  });
});

module.exports = router;
