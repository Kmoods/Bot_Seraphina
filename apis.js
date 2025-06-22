const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const search = require("yt-search");
const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const youtubedl = require("youtube-dl-exec");
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const app = express();
const router = express.Router();

const semkeyPath = path.join(__dirname, "public", "semkey.html");
const PathUser = path.join(__dirname, "dados", "usuarios.json");

let apikeys = []; // lista de chaves atualizada

// Função auxiliar para carregar usuários
function carregarUsuarios() {
  if (!fs.existsSync(PathUser)) return [];
  const dados = fs.readFileSync(PathUser, "utf-8");
  return JSON.parse(dados || "[]");
}

// Salvar usuários no arquivo
function salvarUsuarios(usuarios) {
  fs.writeFileSync(PathUser, JSON.stringify(usuarios, null, 2));
}

// 🔁 Atualiza a lista de apikeys globais
function atualizarApiKeys() {
  const usuarios = carregarUsuarios();
  apikeys = usuarios.map((u) => u.chave);
}
atualizarApiKeys();

function atualizarLimitePorChave(chave) {
  let usuarios = carregarUsuarios();
  let usuario = usuarios.find((u) => u.chave === chave);

  if (!usuario) {
    return { sucesso: false, mensagem: "Chave não encontrada." };
  }

  if (usuario.requisicoes === usuario.limite) {
    return { sucesso: false, mensagem: "Limite de requisições excedido." };
  }

  usuario.requisicoes += 1;
  salvarUsuarios(usuarios);

  let requisicoes_retante = usuario.limite - usuario.requisicoes;
  return { sucesso: true, restante: requisicoes_retante };
}

// ✅ Middleware para verificação de API Key
function verificarKey(req, res, next) {
  const key = req.query.apikey;

  if (!key) {
    return res.status(403).sendFile(semkeyPath);
  }

  let usuarios = carregarUsuarios();
  const usuario = usuarios.find((u) => u.chave === key);

  if (!usuario) {
    return res.status(403).json({ error: "API Key inválida." });
  }

  if (usuario.plano !== "gratuito" && usuario.requisicoes >= usuario.limite) {
    return res.status(429).json({ error: "Limite de requisições atingido." });
  }

  usuario.requisicoes = (usuario.requisicoes || 0) + 1;
  salvarUsuarios(usuarios);

  req.usuario = usuario;
  next();
}

// 🔄 Reset diário programado para 00:00
function resetarRequisicoes() {
  let usuarios = carregarUsuarios();
  usuarios = usuarios.map((u) => {
    u.requisicoes = 0;
    return u;
  });

  salvarUsuarios(usuarios);
  atualizarApiKeys(); // mantém a lista sincronizada
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

// ✅ Endpoint de verificação de chave
router.post("/api/validar-chave", (req, res) => {
  const { numero, chave } = req.body;

  if (!numero || !chave) {
    return res
      .status(400)
      .json({ message: "Número e chave são obrigatórios." });
  }

  let usuarios = carregarUsuarios();
  let usuario = usuarios.find((u) => u.numero === numero && u.chave === chave);

  if (!usuario) {
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
  salvarUsuarios(usuarios);

  return res.status(200).json({
    message: "Chave válida.",
    plano: usuario.plano,
    limite,
    usadas: usuario.requisicoes,
  });
});

router.post("/api/save-user", (req, res) => {
  const { numero, chave, plano, limite, token } = req.body;

  if (!numero || !chave || !plano || !limite) {
    return res.status(400).json({ message: "Dados incompletos." });
  }

  let usuarios = carregarUsuarios();

  // Se token existir, atualizar usuário existente
  let usuario = usuarios.find((u) => u.token === token);

  if (!usuario) {
    // Criar novo usuário com token único
    const novoToken = "token_" + Math.random().toString(36).substring(2, 15);
    usuario = {
      numero,
      chave,
      plano,
      limite,
      token: novoToken,
      requisicoes: 0,
    };
    usuarios.push(usuario);
  } else {
    // Atualiza dados do usuário existente
    usuario.numero = numero;
    usuario.chave = chave;
    usuario.plano = plano;
    usuario.limite = limite;
    // requisicoes fica como está
  }

  salvarUsuarios(usuarios);

  return res.json({
    message: "Usuário salvo com sucesso.",
    token: usuario.token,
  });
});

// GET /api/user-info
router.get("/api/user-info", (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ message: "Token é obrigatório." });
  }

  const usuarios = carregarUsuarios(); // Certifique que carregarUsuarios retorna um array válido
  if (!Array.isArray(usuarios)) {
    return res.status(500).json({ message: "Erro ao carregar usuários." });
  }

  const usuario = usuarios.find((u) => u.token === token);

  if (!usuario) {
    return res
      .status(404)
      .json({ message: "Usuário não encontrado para esse token." });
  }

  // Retornando os dados esperados
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

// Função para carregar os dados
function carregarUsuarios() {
  if (!fs.existsSync(PathUser)) return [];
  const data = fs.readFileSync(PathUser, "utf8");
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

router.get("/api/playAudio", async (req, res) => {
  const apikey = req.query.apikey;
  const videoUrl = req.query.url;

  //Sistema de contar se o user ja ecedeu  o limite ou não
  const chave = apikey; // ou req.headers["x-api-key"]
  if (!chave) return res.status(400).json({ error: "Chave não enviada." });

  const resultado = atualizarLimitePorChave(chave);
  if (!resultado.sucesso) {
    return res.status(403).json({ error: resultado.mensagem });
  }

  if (!apikey || !apikeys.includes(apikey)) {
   
    return res
      .status(403)
      .json({ error: "API Key inválida ou não fornecida." });
  }

  if (!videoUrl) {
    return res
      .status(400)
      .json({ error: "É necessário fornecer a URL do vídeo." });
  }

  try {
    const videoId = new URL(videoUrl).searchParams.get("v");
    if (!videoId) {
      return res.status(400).json({ error: "URL do vídeo inválida." });
    }

    console.log("🎵 Iniciando download do áudio para URL:", videoUrl);

    const videoInfo = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    const fileName = `${videoInfo.title.replace(/[<>:"/\\|?*]+/g, "")}.mp3`;
    const audioFilePath = path.join(__dirname, "temp", fileName);

    await youtubedl(videoUrl, {
      output: audioFilePath,
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: "0",
    });

    console.log("✅ Download concluído. Enviando...");

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.download(audioFilePath, fileName, (err) => {
      if (err) {
        console.error("❌ Erro ao enviar o arquivo:", err.message);
      } else {
        console.log("📤 Arquivo enviado com sucesso.");

        setTimeout(() => {
          fs.unlink(audioFilePath, (err) => {
            if (err)
              console.error("❌ Erro ao remover o arquivo:", err.message);
            else console.log("🧹 Arquivo temporário removido.");
          });
        }, 52000);
      }
    });
  } catch (error) {
    console.error("❌ Erro geral:", error.message);
    return res
      .status(500)
      .json({ error: "Erro ao processar sua solicitação." });
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
router.get("/api/video-aleatorio", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    // Caminho para o arquivo JSON
    const videoFilePath = path.join(__dirname, "dados", "videos.json");

    // Função para ler o arquivo JSON
    function lerArquivoJSON() {
      const rawdata = fs.readFileSync(videoFilePath);
      return JSON.parse(rawdata);
    }

    try {
      // Carregar os GIFs do arquivo JSON
      const videoData = lerArquivoJSON();
      const videos = videoData.videos;

      // Escolher um GIF aleatório
      const randomIndex = Math.floor(Math.random() * videos.length);
      const randomVideoUrl = videos[randomIndex];

      // Fazer requisição para obter o GIF
      const response = await axios.get(randomVideoUrl, {
        responseType: "arraybuffer",
      });

      // Enviar o GIF como resposta
      res.set("Content-Type", "video/mp4"); // Define o tipo de conteúdo como imagem GIF
      res.send(Buffer.from(response.data, "binary"));
    } catch (error) {
      console.error("Erro ao obter o vidso aleatório:", error);
      res.status(500).send("Erro ao obter VIDEO aleatório");
    }
  } else {
    res.sendFile(semkeyPath);
  }
});

// Rota para obter uma imagem aleatória
router.get("/api/loli-aleatoria", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    // Caminho para o arquivo JSON
    const loliFilePath = path.join(__dirname, "dados", "loli.json");

    // Função para ler o arquivo JSON
    function lerArquivoJSON() {
      const rawdata = fs.readFileSync(loliFilePath);
      return JSON.parse(rawdata);
    }

    try {
      // Carregar as imagens do arquivo JSON
      const loliData = lerArquivoJSON();
      const venomlolis = loliData.venomlolis;

      // Escolher uma imagem aleatória
      const randomIndex = Math.floor(Math.random() * venomlolis.length);
      const randomLoliUrl = venomlolis[randomIndex];

      // Fazer requisição para obter a imagem
      const response = await axios.get(randomLoliUrl, {
        responseType: "arraybuffer",
      });

      // Enviar a imagem como resposta
      res.set("Content-Type", "image/jpeg"); // Define o tipo de conteúdo como imagem JPEG
      res.send(Buffer.from(response.data, "binary"));
    } catch (error) {
      console.error("Erro ao obter a imagem aleatória:", error);
      res.status(500).send("Erro ao obter a imagem aleatória");
    }
  } else {
    res.sendFile(semkeyPath);
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
router.get("/api/frase-aleatoria", (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    try {
      // Caminho para o arquivo JSON com as frases
      const filePath = path.join(__dirname, "dados", "frases.json");

      // Lendo o conteúdo do arquivo JSON
      const frasesData = fs.readFileSync(filePath, "utf8");
      const frases = JSON.parse(frasesData);

      // Escolhendo aleatoriamente uma frase
      const randomIndex = Math.floor(Math.random() * frases.length);
      const fraseAleatoria = frases[randomIndex];

      res.json({ criador: "Kmods", frase: fraseAleatoria });
    } catch (error) {
      console.error("Erro ao ler o arquivo JSON:", error);
      res.status(500).json({ error: "Erro ao obter frase aleatória" });
    }
  } else {
    res.sendFile(semkeyPath);
  }
});

// Rota para obter imagem aleatória do arquivo JSON local
router.get("/api/imagem-aleatoria", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    try {
      // Caminho para o arquivo JSON
      const filePath = path.join(__dirname, "dados", "imagens.json");

      // Lendo o conteúdo do arquivo JSON
      const venomimagensData = fs.readFileSync(filePath, "utf8");
      const venomimagens = JSON.parse(venomimagensData).venomimagens;

      // Escolhendo aleatoriamente uma URL de imagem
      const imagemAleatoria =
        venomimagens[Math.floor(Math.random() * venomimagens.length)];

      // Fazendo requisição para obter a imagem
      const response = await axios.get(imagemAleatoria, {
        responseType: "arraybuffer",
      });

      // Enviando a imagem como resposta
      res.set("Content-Type", "image/jpeg"); // Define o tipo de conteúdo como imagem JPEG
      res.send(Buffer.from(response.data, "binary"));
    } catch (error) {
      console.error("Erro ao obter imagem aleatória:", error);
      res.status(500).send("Erro ao obter imagem aleatória");
    }
  } else {
    res.sendFile(semkeyPath);
  }
});

// Rota para obter imagem aleatória do arquivo JSON local
router.get("/api/imagem-dev", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    try {
      // Caminho para o arquivo JSON
      const filePath = path.join(__dirname, "dados", "fotodev.json");

      // Lendo o conteúdo do arquivo JSON
      const venomimagensData = fs.readFileSync(filePath, "utf8");
      const venomimagens = JSON.parse(venomimagensData).venomimagens;

      // Escolhendo aleatoriamente uma URL de imagem
      const imagemAleatoria =
        venomimagens[Math.floor(Math.random() * venomimagens.length)];

      // Fazendo requisição para obter a imagem
      const response = await axios.get(imagemAleatoria, {
        responseType: "arraybuffer",
      });

      // Enviando a imagem como resposta
      res.set("Content-Type", "image/jpeg"); // Define o tipo de conteúdo como imagem JPEG
      res.send(Buffer.from(response.data, "binary"));
    } catch (error) {
      console.error("Erro ao obter imagem aleatória:", error);
      res.status(500).send("Erro ao obter imagem aleatória");
    }
  } else {
    res.sendFile(semkeyPath);
  }
});

// Rota para obter imagem aleatória do arquivo JSON local
router.get("/api/imagem-pokemon", async (req, res) => {
  const apikey = req.query.apikey;
  if (!apikeys) {
    return res
      .status(500)
      .json({ error: "Digite sua apikey no parâmetro do url" });
  }

  if (apikeys.includes(apikey)) {
    try {
      // Caminho para o arquivo JSON
      const filePath = path.join(__dirname, "dados", "pokemon.json");

      // Lendo o conteúdo do arquivo JSON
      const venomimagensData = fs.readFileSync(filePath, "utf8");
      const venomimagens = JSON.parse(venomimagensData).venomimagens;

      // Escolhendo aleatoriamente uma URL de imagem
      const imagemAleatoria =
        venomimagens[Math.floor(Math.random() * venomimagens.length)];

      // Fazendo requisição para obter a imagem
      const response = await axios.get(imagemAleatoria, {
        responseType: "arraybuffer",
      });

      // Enviando a imagem como resposta
      res.set("Content-Type", "image/jpeg"); // Define o tipo de conteúdo como imagem JPEG
      res.send(Buffer.from(response.data, "binary"));
    } catch (error) {
      console.error("Erro ao obter imagem aleatória:", error);
      res.status(500).send("Erro ao obter imagem aleatória");
    }
  } else {
    res.sendFile(semkeyPath);
  }
});

// GET - Lista todos os usuários
router.get("/api/usuarios", (req, res) => {
  const usuarios = carregarUsuarios();
  res.json(usuarios);
});


// DELETE - Remove usuário por chave
router.delete("/api/deletar-usuario", (req, res) => {
  const { chave } = req.query;

  if (!chave) {
    return res.status(400).json({ message: "Chave do usuário não fornecida." });
  }

  const usuarios = carregarUsuarios();
  const novosUsuarios = usuarios.filter((u) => u.chave !== chave);

  if (novosUsuarios.length === usuarios.length) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  salvarUsuarios(novosUsuarios);
  res.json({ message: "Usuário deletado com sucesso." });
});

// PUT - Edita usuário (atualiza plano)
router.put("/api/editar-usuario", (req, res) => {
  const { numero, plano } = req.body;
  if (!numero || !plano) {
    return res
      .status(400)
      .json({ message: "Número e plano são obrigatórios." });
  }

  let usuarios = carregarUsuarios();
  const usuario = usuarios.find((u) => u.numero === numero);

  if (!usuario) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  usuario.plano = plano;

  salvarUsuarios(usuarios);

  return res.json({ message: "Plano alterado com sucesso." });
});

// GET - lista todos usuários
router.get("/api/usuarios", (req, res) => {
  const usuarios = carregarUsuarios();
  res.json(usuarios);
});

// DELETE - remove usuário por chave (número)
router.delete("/api/deletar-usuario", (req, res) => {
  const { chave } = req.query;
  let usuarios = carregarUsuarios();
  const novosUsuarios = usuarios.filter((u) => u.numero !== chave);

  if (novosUsuarios.length === usuarios.length) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  salvarUsuarios(novosUsuarios);
  res.json({ message: "Usuário deletado com sucesso." });
});

// PUT - alterar plano do usuário
router.put("/api/alterar-plano", (req, res) => {
  const { chave, plano } = req.body;
  let usuarios = carregarUsuarios();
  const usuario = usuarios.find((u) => u.numero === chave);

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

  usuario.limite = limitesPorPlano[plano] || 60; // padrão 60 se não achar

  salvarUsuarios(usuarios);
  res.json({
    message: "Plano e limite alterados com sucesso.",
    limite: usuario.limite,
  });
});

router.get("/api/status", (req, res) => {
  const start = Date.now();

  // Memory usage in bytes
  const memoryUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // Number of users online (assuming all users in usuarios.json are online)
  const usuarios = carregarUsuarios();
  const totalUsers = usuarios.length;

  // Simulate ping as response time
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
