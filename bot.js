const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadContentFromMessage,
  downloadMediaMessage,
  generateWAMessageFromContent,
  proto,
  prepareWAMessageMedia,
} = require("@whiskeysockets/baileys");
const pino = require("pino");

const axios = require("axios");
const readline = require("readline");
const motivacao = require('./motivation.js');
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const ffmpeg = require('fluent-ffmpeg')
const search = require("yt-search");
const iaDB = JSON.parse(fs.readFileSync("./ia.json"));
const { exec } = require("child_process")
const { menu } = require("./menu");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { error } = require("console");
const prefixo = "!";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const dataAtual = new Date().toLocaleDateString("pt-BR");
const timeManaus = () =>
  new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" });

// Variável global para modo restrito
global.somenteAdmEscola = false;

// Funções utilitárias para JSON
function lerJSON(caminho) {
  try {
    if (!fs.existsSync(caminho)) return {};
    const data = fs.readFileSync(caminho, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Erro ao ler JSON:", e);
    return {};
  }
}

function salvarJSON(caminho, dados) {
  try {
    fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
  } catch (e) {
    console.error("Erro ao salvar JSON:", e);
  }
}

// Funções para restrito e auto-lembrete (funcoes.json)
function lerFuncoesJson(callback) {
  let funcoes = lerJSON("./data/funcoes.json");
  if (!funcoes.length) funcoes = [{ autoLembrAtivo: false, restrito: false }];
  callback(funcoes[0]);
}
function salvarFuncoesJson(autoLembrAtivo, restrito, callback) {
  let funcoes = [{ autoLembrAtivo, restrito }];
  salvarJSON("./data/funcoes.json", funcoes);
  if (callback) callback(true);
}
// Funções para grupos (grupos.json)
function getModoGrupoJson(grupoId, callback) {
  const grupos = lerJSON("./data/grupos.json");
  const grupo = grupos.find(g => g.grupoId === grupoId);
  callback(grupo ? grupo.modo : null);
}

function setModoGrupoJson(grupoId, nomeGrupo, modo, callback, quemAdicionou = null) {
  let grupos = lerJSON("./data/grupos.json");
  let existente = grupos.find(g => g.grupoId === grupoId);

  if (existente) {
    existente.modo = modo;
    existente.nome = nomeGrupo; // Atualiza nome também, caso tenha mudado
  } else {
    grupos.push({
      id: grupos.length + 1,
      grupoId,
      nome: nomeGrupo,
      modo,
      dataEntrada: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      adicionadoPor: quemAdicionou || "Desconhecido"
    });
  }

  salvarGruposOrdenados(grupos);
  callback(true);
}


function salvarGruposOrdenados(grupos) {
  const gruposOrdenados = grupos.map((g, index) => ({
    ...g,
    id: index + 1
  }));
  fs.writeFileSync("./data/grupos.json", JSON.stringify(gruposOrdenados, null, 2));
  return gruposOrdenados;
}

function grupoCadastradoJson(grupoId, callback) {
  const grupos = lerJSON("./data/grupos.json");
  callback(!!grupos.find(g => g.grupoId === grupoId));
}


// TAREFAS AGRUPADAS POR 'from'
const CAMINHO_TAREFAS = "./data/tarefas.json";

function listarTarefasJson(from, callback) {
  const dados = lerJSON(CAMINHO_TAREFAS);
  const tarefas = dados[from] || [];

  if (!tarefas.length)
    return callback("🗒️ *Lista de Tarefas:*\n\n> Nenhuma tarefa adicionada no momento.");

  let mensagem = `╭───❍ *📑 Lista de Tarefas*\n│\n`;
  tarefas.forEach((tarefa) => {
    mensagem += `│ 🆔 *ID:* ${tarefa.id}
│ ✍️ *Descrição:* ${tarefa.descricao}
│ 📅 *Postada:* ${tarefa.data}
│ ⏳ *Entrega:* ${tarefa.entregar}
│ ${tarefa.feita ? "✅ *Status:* Concluída" : "📋 *Status:* Pendente"}
│━━━━━━━━━━━━━━━━━\n`;
  });
  mensagem += "╰───────────────❍";
  callback(mensagem);
}

function adicionarTarefaJson(from, descricao, dataEntrega, callback) {
  const dados = lerJSON(CAMINHO_TAREFAS);
  if (!dados[from]) dados[from] = [];

  const tarefas = dados[from];
  const id = tarefas.length ? tarefas[tarefas.length - 1].id + 1 : 1;

  tarefas.push({
    id,
    descricao,
    data: new Date().toLocaleDateString("pt-BR"),
    entregar: dataEntrega,
    feita: false,
  });

  salvarJSON(CAMINHO_TAREFAS, dados);
  callback(`✅ Tarefa adicionada: ${descricao} (Entrega: ${dataEntrega})`);
}

function marcarTarefaComoFeitaJson(from, id, callback) {
  const dados = lerJSON(CAMINHO_TAREFAS);
  const tarefas = dados[from];
  if (!tarefas) return callback("⚠️ Nenhuma tarefa encontrada para este grupo.");

  const idx = tarefas.findIndex((t) => t.id === id);
  if (idx >= 0) {
    tarefas[idx].feita = true;
    salvarJSON(CAMINHO_TAREFAS, dados);
    callback(`✅ Tarefa #${id} marcada como feita.`);
  } else {
    callback("❌ Erro ao marcar tarefa como feita.");
  }
}

function excluirTarefasJson(from, idsArray, callback) {
  const dados = lerJSON(CAMINHO_TAREFAS);
  if (!dados[from]) return callback("⚠️ Nenhuma tarefa encontrada neste grupo.");

  let tarefas = dados[from];
  const original = tarefas.length;

  tarefas = tarefas.filter((t) => !idsArray.includes(t.id));

  // Reorganiza os IDs para ficarem sequenciais após exclusão
  tarefas.forEach((t, i) => (t.id = i + 1));
  dados[from] = tarefas;

  salvarJSON(CAMINHO_TAREFAS, dados);

  const removidos = original - tarefas.length;
  if (removidos === 0)
    callback("⚠️ Nenhuma tarefa encontrada com esses IDs.");
  else callback(`🗑️ *Tarefas excluídas:* ${idsArray.join(", ")}`);
}

const CAMINHO_LEMBRETES = "./data/lembretes.json";

function listarLembretesJson(from, callback) {
  const dados = lerJSON(CAMINHO_LEMBRETES);
  const lembretes = dados[from] || [];

  if (!lembretes.length)
    return callback("⚠️ Nenhum lembrete encontrado para este grupo.");

  let msg = `📜 *Lembretes deste grupo:*\n\n`;
  lembretes.forEach((l) => {
    msg += `🆔 *ID:* ${l.id}\n📝  _${l.descricao}_\n`;
    if (l.tipo === "auto") {
      msg += `🔁 *Auto-lembrete:* a cada ${l.frequencia} dia(s)\n📅 *Última:* ${l.ultimaExecucao || "Nenhuma ainda"
        }\n`;
    } else {
      msg += `📅 *Data:* ${l.data || ""}\n⏰ *Hora:* ${l.hora || ""}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  });
  callback(msg);
}

function adicionarLembreteJson(from, descricao, tipo, frequencia, data, hora, callback) {
  const dados = lerJSON(CAMINHO_LEMBRETES);
  if (!dados[from]) dados[from] = [];

  const lembretes = dados[from];
  const id = lembretes.length ? lembretes[lembretes.length - 1].id + 1 : 1;

  lembretes.push({
    id,
    descricao,
    tipo,
    frequencia,
    ultimaExecucao: null,
    data,
    hora,
    dataCriacao: new Date().toISOString().split("T")[0],
  });

  salvarJSON(CAMINHO_LEMBRETES, dados);
  callback(`✅ Lembrete adicionado!\n📝 *${descricao}*\n🆔 *ID:* ${id}`);
}

function excluirLembretesJson(from, ids, callback) {
  const dados = lerJSON(CAMINHO_LEMBRETES);
  if (!dados[from]) return callback("⚠️ Nenhum lembrete encontrado neste grupo.");

  const idsArray = ids
    .split(/[\s,]+/)
    .map((id) => parseInt(id))
    .filter((id) => !isNaN(id));

  const lembretes = dados[from];
  const original = lembretes.length;

  const novos = lembretes.filter((l) => !idsArray.includes(l.id));

  // Reorganiza os IDs para ficarem sequenciais após exclusão
  novos.forEach((l, i) => (l.id = i + 1));
  dados[from] = novos;

  salvarJSON(CAMINHO_LEMBRETES, dados);

  const removidos = original - novos.length;
  if (removidos === 0)
    callback("⚠️ Nenhum lembrete encontrado com esses IDs neste grupo.");
  else callback(`🗑️ *Lembretes excluídos:* ${idsArray.join(", ")}`);
}


async function obterPlaylist(query) {
  const clientId = "84c7e773bdca4d4eb172ef0b8f9d7e78";
  const clientSecret = "ef524f7e76354ada8cbf8dc80a9461b6";
  const authResponse = await axios.post(
    "https://accounts.spotify.com/api/token",
    null,
    {
      params: { grant_type: "client_credentials" },
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    }
  );
  const accessToken = authResponse.data.access_token;
  const response = await axios.get(`https://api.spotify.com/v1/search`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q: query, type: "track", limit: 10 },
  });
  const tracks = response.data.tracks.items;
  if (tracks.length > 0) {
    const track = tracks[0];
    return `🎵 Aqui está a música que você pediu: ${track.name} - ${track.artists.map(artist => artist.name).join(", ")}\n${track.external_urls.spotify}`;
  } else {
    return `Desculpe, não consegui encontrar a música "${query}".`;
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./conexao");
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`🟢 Usando versão ${version.join(".")} | Última versão: ${isLatest}`);
  const client = makeWASocket({
    logger: pino({ level: "silent" }),
    browser: ["Bot_Seraphina", "Chrome", "3.0"],
    auth: state,
    version,
  });
  client.ev.on("creds.update", saveCreds);

  client.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log("📲 Escaneie este QR Code:");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      switch (reason) {
        case DisconnectReason.badSession:
          console.log('❌ Sessão inválida. Delete a pasta "conexao" e escaneie novamente.');
          process.exit();
          break;
        case DisconnectReason.connectionClosed:
        case DisconnectReason.connectionLost:
        case DisconnectReason.restartRequired:
        case DisconnectReason.timedOut:
          console.log("🔌 Reconectando...");
          startBot();
          break;
        case DisconnectReason.loggedOut:
          console.log("🚫 Deslogado. Escaneie novamente.");
          process.exit();
          break;
        default:
          console.log("❌ Desconectado. Motivo desconhecido. Reconectando...");
          startBot();
          break;
      }
    }
    if (connection === "open") {
      console.log("✅ Conectado com sucesso!");
    }
  });

  client.ev.on("messages.upsert", async (m) => {
    if (!state.creds.me) return;
    const info = m.messages && m.messages[0];
    if (!info || !info.message || info.key.fromMe) return;
    const body = info.message.conversation || info.message.extendedTextMessage?.text || "";
    if (!body.startsWith(prefixo)) return; // Só responde comandos com prefixo
    const isGroup = info.key.remoteJid.endsWith("@g.us");
    const from = info.key.remoteJid;
    const pushname = info.pushName || "Usuario sem nome";
    const args = body.slice(prefixo.length).trim().split(/ +/);
    const command = args[0].toLowerCase();
    const comando = command;
    const query = args.slice(1).join(" ").trim();
    const q = query;
    const sender = info.key.participant || info.key.remoteJid;
    const modoNumero = args[1];
    const modosMap = { 1: "empresarial", 2: "escolar", 3: "facultativo", 4: "amizade" };
    const Random = Math.random(10)
    const altpdf = Object.keys(info.message)
    const type = altpdf[0] == 'senderKeyDistributionMessage' ? altpdf[1] == 'messageContextInfo' ? altpdf[2] : altpdf[1] : altpdf[0]
    type_message = JSON.stringify(info.message)
    const isQuotedImage = type === "extendedTextMessage" && type_message.includes("imageMessage");
    const imagem_menu = "./data/img/menu.jpg"
    const mandar = (conteudo) => {
      const fraseAleatoria = motivacao.getRandomMotivation(); // chama a função
      client.sendMessage(from, {
        image: fs.readFileSync(imagem_menu),
        caption: `${conteudo}\n\n> 💭 *_${fraseAleatoria}_*`
      }, { quoted: info });
    }
    const mandar2 = async (conteudo) => {
      await client.sendMessage(from, { text: conteudo }, { quoted: info })
    }

    // Verifica cadastro do grupo
    if (isGroup) {
      const cadastrado = await new Promise((resolve) => {
        grupoCadastradoJson(from, (c) => resolve(c));
      });
      if (!cadastrado && !["cadastrar", "registrar"].includes(comando)) {
        await mandar(`🚫 Este grupo não está cadastrado no sistema.\n\n👉 Peça ao dono do bot para cadastrá-lo com *!cadastrar*.`);
        return;
      }
    }

    // Função para verificar se é ADM ou dono
    async function podeExecutarRestrito() {
      if (sender.includes("556981134127")) return true;
      if (!isGroup) return false;
      const groupMetadata = await client.groupMetadata(from);
      const isAdmin = groupMetadata.participants.some(
        p => p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
      );
      return isAdmin;
    }

    // Função para verificar modo do grupo
    async function modoGrupoAtual() {
      return await new Promise((resolve) => {
        getModoGrupoJson(from, (modo) => resolve(modo));
      });
    }



    switch (command) {
      //Comandos de segurança
      // Ativação do modo restrito
      case "restrito":
        if (!(await podeExecutarRestrito())) {
          await mandar("❌ Apenas administradores ou o proprietário podem ativar/desativar o modo restrito.");
          break;
        }
        if (args[1] === "on") {
          global.somenteAdmEscola = true;
          await mandar("🔒 Modo restrito ativado: apenas administradores podem adicionar/excluir atividades e lembretes no modo escolar.");
        } else if (args[1] === "off") {
          global.somenteAdmEscola = false;
          await mandar("🔓 Modo restrito desativado: todos podem adicionar/excluir atividades e lembretes.");
        } else {
          await mandar("Use:\n!restrito on - Ativa o modo restrito\n!restrito off - Desativa o modo restrito");
        }
        break;

      case "cadastrar":
      case "registrar":
        if (!isGroup) {
          return client.sendMessage(from, { text: "❌ Esse comando só funciona em grupos." });
        }

        grupoCadastradoJson(from, (cadastrado) => {
          if (cadastrado) {
            return client.sendMessage(from, { text: "✅ Este grupo já está cadastrado no sistema." });
          }

          client.groupMetadata(from).then((metadata) => {
            const quemAdicionou = info.pushName || info.participant || info.key?.participant || "Desconhecido";

            if (modoNumero && modosMap[modoNumero]) {
              setModoGrupoJson(from, metadata.subject, modosMap[modoNumero], (ok) => {
                client.sendMessage(from, {
                  text: `✅ Grupo cadastrado com sucesso no modo *${modosMap[modoNumero]}*!`,
                });
              }, quemAdicionou);
            } else {
              setModoGrupoJson(from, metadata.subject, null, (ok) => {
                client.sendMessage(from, {
                  text: `✅ Grupo cadastrado com sucesso! Use o comando *!modo [número]* para definir o modo:\n\n1️⃣ Empresarial\n2️⃣ Escolar\n3️⃣ Facultativo\n4️⃣ Amizade\n\nPara alterar o modo do grupo a qualquer momento, use o comando *!modo [número]*.`,
                });
              }, quemAdicionou);
            }
          });
        });
        break;

      case "modo":
        if (!modoNumero || !modosMap[modoNumero]) {
          await mandar2(
            `❌ Modo inválido! Use o número correspondente:\n\n1️⃣ Empresarial\n2️⃣ Escolar\n3️⃣ Facultativo\n4️⃣ Amizade`
          );
          break;
        }

        grupoCadastradoJson(from, (cadastrado) => {
          if (!cadastrado) {
            mandar2("❌ Este grupo não está cadastrado. Use *!cadastrar* primeiro.");
            return;
          }

          client.groupMetadata(from).then((metadata) => {
            setModoGrupoJson(from, metadata.subject, modosMap[modoNumero], (ok) => {
              if (ok) {
                mandar2(`✅ Modo do grupo definido como: *${modosMap[modoNumero]}*`);
              } else {
                mandar2("❌ Erro ao definir o modo.");
              }
            });
          });
        });
        break;
      //================================================================\\

      //Comandos basicos dos modos

      //Modo escolar
      case "add-tarefa":
        if (global.somenteAdmEscola && (await modoGrupoAtual()) === "escolar" && !sender.includes("556981134127")) {
          if (!(await podeExecutarRestrito())) {
            await mandar("❌ Apenas administradores podem adicionar tarefas no modo escolar com restrição ativada.");
            break;
          }
        }
        const input = args.slice(1).join(" ").trim();
        if (input.length > 0) {
          let tarefasInput = input.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
          if (tarefasInput.length > 6) {
            await mandar(`Você tentou adicionar mais de 6 tarefas. Apenas as primeiras 6 serão adicionadas.`);
            tarefasInput = tarefasInput.slice(0, 6);
          }
          let mensagensAdicionadas = [];
          let count = 0;
          tarefasInput.forEach((tarefaStr) => {
            const [descricao, dataEntregaRaw] = tarefaStr.split("/").map((s) => s.trim());
            const dataEntrega = dataEntregaRaw || "Sem data";
            adicionarTarefaJson(from, descricao, dataEntrega, (msg) => {
              mensagensAdicionadas.push(`- ${descricao} (Entrega: ${dataEntrega})`);
              count++;
              if (count === tarefasInput.length) {
                listarTarefasJson(from, async (mensagem) => {
                  await mandar(`Tarefas adicionadas:\n${mensagensAdicionadas.join("\n")}\n\n${mensagem}\n`);
                });
              }
            });
          });
        } else {
          await mandar(
            `*Erro: Nenhuma tarefa fornecida!*\nInstruções:\n- Para adicionar múltiplas tarefas, separe-as com ','.\n- Para cada tarefa, use '/' para separar descrição e data.\n- Exemplo: !add-tarefa tarefa1 / 30.05.2025, tarefa2 / 07.01.2024`
          );
        }
        break;

      case "feito":
        const ids = args.slice(1).map((idStr) => parseInt(idStr, 10)).filter((id) => !isNaN(id));
        if (ids.length > 0) {
          let count = 0;
          ids.forEach((id) => {
            marcarTarefaComoFeitaJson(from, id, (msg) => {
              count++;
              if (count === ids.length) {
                listarTarefasJson(from, async (mensagem) => {
                  await mandar(`Tarefas #${ids.join(", ")} marcadas como feitas ✅\n\n${mensagem}`);
                });
              }
            });
          });
        } else {
          await mandar(`Erro: IDs inválidos.`);
        }
        break;

      case "tarefas":
      case "tarefa":
        listarTarefasJson(from, async (mensagem) => {
          await mandar(mensagem);
        });
        break;

      case "del-tarefa":
      case "del-tarefas":
        if (global.somenteAdmEscola && (await modoGrupoAtual()) === "escolar" && !sender.includes("556981134127")) {
          if (!(await podeExecutarRestrito())) {
            await mandar("❌ Apenas administradores podem excluir tarefas no modo escolar com restrição ativada.");
            break;
          }
        }
        if (!args[1]) {
          client.sendMessage(from, {
            text: "❌ Informe os IDs das tarefas que deseja excluir.\nExemplo: !del-tarefa 1 2 3",
          });
          break;
        } else {
          const idsArray = args.slice(1)
            .map((id) => parseInt(id))
            .filter((id) => !isNaN(id));
          if (!idsArray.length) {
            client.sendMessage(from, { text: "❌ Nenhum ID válido informado." });
            break;
          }
          excluirTarefasJson(from, idsArray, (resposta) => {
            client.sendMessage(from, { text: resposta });
          });
        }
        break;

      case "add-lembrete":
        if (global.somenteAdmEscola && (await modoGrupoAtual()) === "escolar" && !sender.includes("556981134127")) {
          if (!(await podeExecutarRestrito())) {
            await mandar("❌ Apenas administradores podem adicionar lembretes no modo escolar com restrição ativada.");
            break;
          }
        }
        if (!q) {
          client.sendMessage(from, {
            text: `❌ *Formato incorreto!*\n\nUse:\n!add-lembrete (auto)/descrição/frequência (em dias)\n\nSe não for auto, apenas:\n!add-lembrete descrição`,
          });
          break;
        }
        const comando_lembrete = body.slice("!add-lembrete ".length).trim();
        const partes = comando_lembrete.split("/").map((e) => e.trim());
        if (partes[0].toLowerCase() === "auto") {
          const descricao = partes[1];
          const frequencia = parseInt(partes[2]);
          if (!descricao || isNaN(frequencia)) {
            client.sendMessage(from, {
              text: `❌ *Formato incorreto!*\n\nUse:\n!add-lembrete (auto)/descrição/frequência (em dias)`,
            });
            break;
          }
          adicionarLembreteJson(from, descricao, "auto", frequencia, null, null, (msg) => {
            client.sendMessage(from, { text: msg });
          });
        } else {
          const descricao = partes.join(" ");
          adicionarLembreteJson(from, descricao, "normal", null, null, null, (msg) => {
            client.sendMessage(from, { text: msg });
          });
        }
        break;

      case "del-lembrete":
        if (global.somenteAdmEscola && (await modoGrupoAtual()) === "escolar" && !sender.includes("556981134127")) {
          if (!(await podeExecutarRestrito())) {
            await mandar("❌ Apenas administradores podem excluir lembretes no modo escolar com restrição ativada.");
            break;
          }
        }
        if (!args[0]) {
          client.sendMessage(from, {
            text: "❌ Informe os IDs dos lembretes que deseja excluir.\nExemplo: !del-lembrete 1 2 3",
          });
        } else {
          excluirLembretesJson(from, args.join(" "), (resposta) => {
            client.sendMessage(from, { text: resposta });
          });
        }
        break;

      case "lembretes":
        listarLembretesJson(from, (mensagem) => {
          client.sendMessage(from, { text: mensagem });
        });
        break;

      // Calculadora avançada (expressões, potências, raiz, seno, etc)
      case "calc": {
        const math = require('mathjs');

        const explicacoes = [
          {
            termo: ["sqrt", "raiz quadrada"],
            nome: "Raiz Quadrada",
            explicacao: "A raiz quadrada de um número é o valor que, multiplicado por ele mesmo, resulta nesse número. Exemplo: sqrt(16) = 4.",
            buscaYoutube: "raiz quadrada matemática"
          },
          {
            termo: ["cbrt", "raiz cúbica"],
            nome: "Raiz Cúbica",
            explicacao: "A raiz cúbica de um número é o valor que, multiplicado por ele mesmo três vezes, resulta nesse número. Exemplo: cbrt(27) = 3.",
            buscaYoutube: "raiz cúbica matemática"
          },
          {
            termo: ["sin", "seno"],
            nome: "Seno",
            explicacao: "O seno é uma função trigonométrica que relaciona o ângulo de um triângulo retângulo com a razão entre o cateto oposto e a hipotenusa.",
            buscaYoutube: "seno trigonometria"
          },
          {
            termo: ["cos", "cosseno"],
            nome: "Cosseno",
            explicacao: "O cosseno é uma função trigonométrica que relaciona o ângulo de um triângulo retângulo com a razão entre o cateto adjacente e a hipotenusa.",
            buscaYoutube: "cosseno trigonometria"
          },
          {
            termo: ["tan", "tangente"],
            nome: "Tangente",
            explicacao: "A tangente é uma função trigonométrica que relaciona o ângulo de um triângulo retângulo com a razão entre o cateto oposto e o cateto adjacente.",
            buscaYoutube: "tangente trigonometria"
          },
          {
            termo: ["log", "logaritmo"],
            nome: "Logaritmo",
            explicacao: "O logaritmo é o expoente ao qual a base deve ser elevada para se obter um número. Exemplo: log(100, 10) = 2.",
            buscaYoutube: "logaritmo matemática"
          },
          {
            termo: ["abs", "módulo"],
            nome: "Módulo",
            explicacao: "O módulo de um número é o seu valor absoluto, ou seja, sem sinal. Exemplo: abs(-10) = 10.",
            buscaYoutube: "valor absoluto matemática"
          },
          {
            termo: ["^", "potência"],
            nome: "Potência",
            explicacao: "Potência é uma operação matemática que representa a multiplicação de um número por ele mesmo várias vezes. Exemplo: 2^3 = 8.",
            buscaYoutube: "potenciação matemática"
          },
          {
            termo: ["!", "fatorial"],
            nome: "Fatorial",
            explicacao: "O fatorial de um número é o produto de todos os inteiros positivos menores ou iguais a ele. Exemplo: 5! = 5×4×3×2×1 = 120.",
            buscaYoutube: "fatorial matemática"
          },
          {
            termo: ["%", "porcentagem"],
            nome: "Porcentagem",
            explicacao: "Porcentagem é uma razão que indica uma parte de 100. Exemplo: 50% de 200 = 100.",
            buscaYoutube: "porcentagem matemática"
          }
          // Adicione mais funções se quiser!
        ];

        const expressao = args.slice(1).join(" ");
        if (!expressao) {
          await mandar(
            `🧮 *Calculadora Avançada Seraphina* 🧮
              
              Você pode calcular expressões matemáticas, científicas e funções avançadas.  
              Veja abaixo o que é possível calcular e exemplos de uso:
              
              ╭─────────────❍
              │ ➕ *Soma:*           !calc 2+2
              │ ➖ *Subtração:*      !calc 10-3
              │ ✖️ *Multiplicação:*  !calc 5*7
              │ ➗ *Divisão:*        !calc 20/4
              │ 🟰 *Parênteses:*     !calc (2+3)*4
              │ ² *Potência:*        !calc 2^8
              │ √ *Raiz quadrada:*   !calc sqrt(16)
              │ ∛ *Raiz cúbica:*     !calc cbrt(27)
              │ % *Porcentagem:*     !calc 50*10%
              │ π *Pi:*              !calc pi*2
              │ 📐 *Seno:*           !calc sin(30 deg)
              │ 📐 *Cosseno:*        !calc cos(60 deg)
              │ 📐 *Tangente:*       !calc tan(45 deg)
              │ log *Logaritmo:*     !calc log(100, 10)
              │ e *Número de Euler:* !calc e^2
              │ ! *Fatorial:*        !calc 5!
              │ |x| *Módulo:*        !calc abs(-10)
              │ min/max *Mín/Máx:*   !calc min(2,5,1) | !calc max(2,5,1)
              │ round *Arredonda:*   !calc round(3.7)
              │ floor/ceil *Piso/Teto:* !calc floor(3.7) | !calc ceil(3.2)
              │ exp *Exponencial:*   !calc exp(2)
              │ random *Aleatório:*  !calc random()
              ╰─────────────❍
              
              *Exemplos avançados:*
              - !calc sqrt(25)+sin(30 deg)*2^3
              - !calc log(1000, 10)
              - !calc (5+3)!/2
              
              *Dicas:*
              - Use "deg" para graus e "rad" para radianos em funções trigonométricas.
              - Você pode combinar várias operações em uma expressão.
              - Funções disponíveis: sqrt, cbrt, sin, cos, tan, log, abs, min, max, round, floor, ceil, exp, random, pow, pi, e, fatorial (!), porcentagem (%).
              
              > Sempre use !calc seguido da expressão desejada.
              `
          );
          break;
        }
        try {
          const resultado = math.evaluate(expressao);

          // Detecta função principal e recomenda vídeos
          let explicacao = null;
          for (const item of explicacoes) {
            if (item.termo.some(t => expressao.toLowerCase().includes(t))) {
              explicacao = item;
              break;
            }
          }

          let recomendacoes = "";
          if (explicacao) {
            const yt = await search(explicacao.buscaYoutube);
            if (yt && yt.videos && yt.videos.length > 0) {
              recomendacoes = "\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *Vídeos recomendados (apenas sugestão):*";
              yt.videos.slice(0, 3).forEach((video, i) => {
                recomendacoes += `\n${i + 1}. ${video.title}\n${video.url}`;
              });
            }
          }

          let resposta = `
              ╭─────────────❍
              │ 🧮 *Expressão:* \`\`\`${expressao}\`\`\`
              │ 
              │ ✅ *Resultado:* \`\`\`${resultado}\`\`\`
              ╰─────────────❍
              `;

          if (explicacao) {
            resposta += `\n📚 *Explicação (${explicacao.nome}):*\n${explicacao.explicacao}`;
          }

          if (recomendacoes) {
            resposta += recomendacoes;
          }
          await mandar(resposta);

        } catch {
          await mandar(
            "❌ Expressão inválida. Use !calc e veja exemplos e instruções detalhadas."
          );
        }
        break;
      }
      // Sorteia um aluno do grupo (útil para apresentações, trabalhos, etc)

      //Modo facultativo

      //Modo empresarial

      //Modo amizade


      //================================================================\\

      //Comando gerais
      case "menu":
        client.sendMessage(from, { react: { text: "💛", key: info.key } });
        getModoGrupoJson(from, (modoMenu) => {
          const textoMenu = menu(prefixo, modoMenu);
          mandar(textoMenu);
        });
        break;

      case "play-spoti":
        if (!query) {
          await mandar("❌ Por favor, informe o nome da música após o comando.");
          break;
        }
        await mandar("🔎 Procurando a música, aguarde...");
        try {
          const resultado = await obterPlaylist(query);
          await mandar(resultado);
        } catch (error) {
          await mandar("❌ Ocorreu um erro ao buscar a música.");
          console.error(error);
        }
        break;

      case "play": {
        return client.sendMessage(from, {
          text: "🚫 O comando !play está temporariamente inativo. Devido a problemas no sistema de api!",
        }, { quoted: info });
      }


      case 's': case 'f': case 'stk': case 'fig':
        if (!isQuotedImage) return mandar2(`Marque uma foto ou video com ${p + comando}`)
        var stream = await downloadContentFromMessage(info.message.imageMessage || info.message.extendedTextMessage?.contextInfo.quotedMessage.imageMessage, 'image')
        mandar2("aguarde...")
        var buffer = Buffer.from([])
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk])
        }
        let ran = `figurinha${Random}.webp`
        fs.writeFileSync(`./${ran}`, buffer)
        ffmpeg(`./${ran}`)
          .on("error", console.error)
          .on("end", () => {
            exec(`webpmux -set exif ./dados/${ran} -o ./${ran}`, async (error) => {

              client.sendMessage(from, {
                sticker: fs.readFileSync(`./${ran}`)
              }, { quoted: info })

              fs.unlinkSync(`./${ran}`)
            })
          })
          .addOutputOptions([
            "-vcodec",
            "libwebp",
            "-vf",
            "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse"
          ])
          .toFormat('webp')
          .save(`${ran}`)
        break


      case 'nomegp':
        if (!isGroup) return mandar2(`Este comando so pode ser usado em grupo`);
        if (!q) return mandar2(` `);
        client.groupUpdateSubject(from, `${q}`)
        client.sendMessage(from, { text: 'Sucesso, alterou o nome do grupo' })
        break

      case 'fotogp':
        if (!isGroup) return mandar2(`Este comando só pode ser usado em grupo`);
        if (!isQuotedImage) return mandar2(`Marque uma imagem com ${p + comando} para alterar a foto do grupo`);

        try {
          const stream = await downloadContentFromMessage(
            info.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage,
            'image'
          );

          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }

          const Jimp = require('jimp'); // funciona com jimp@0.22.10
          const image = await Jimp.read(buffer);
          const resized = await image.resize(720, 720).getBufferAsync(Jimp.MIME_JPEG);

          await client.updateProfilePicture(from, resized);
          client.sendMessage(from, { text: '✅ Sucesso! A imagem do grupo foi atualizada.' }, { quoted: info });

        } catch (err) {
          console.error(err);
          mandar2('❌ Erro ao alterar a imagem do grupo. Verifique se o bot é admin e se a imagem está válida.');
        }
        break;

      case 'report':
      case 'bug':
        if (!q) return mandar2(
          `⚠️ Formato incorreto.\n\nUse o seguinte modelo para relatar um problema:\n\n!report nome-do-comando / descrição do problema\n\nExemplo:\n!report modo / O comando não está respondendo corretamente.`
        );

        mandar2(`Obrigado pelo seu contato, ${pushname}. Seu relatório foi enviado ao desenvolvedor.`);

        client.sendMessage("556981134127@s.whatsapp.net", {
          image: { url: imagem_menu },
          caption: `🔎 *RELATÓRIO DE ERRO*\n━━━━━━━━━━━━━━━\n• *Usuário:* @${sender.split('@')[0]}\n• *Relatório:* ${q}\n• *Sistema:* Bot Seraphina`,
          mentions: [sender],
        }, { quoted: info });

        break;

      case 'novocmd':
        if (!q) return mandar2(
          `⚠️ Formato incorreto.\n\nUse o seguinte modelo para sugerir uma nova funcionalidade:\n\n!novocmd nome-do-comando ou descrição da funcionalidade\n\nExemplo:\n!novocmd comando de verificação de usuários no grupo.`
        );

        mandar2(`Agradecemos pela sugestão, ${pushname}. Sua ideia foi encaminhada ao desenvolvedor para análise.`);

        client.sendMessage("556981134127@s.whatsapp.net", {
          image: { url: imagem_menu },
          caption: `🧩 *SUGESTÃO DE FUNCIONALIDADE*\n━━━━━━━━━━━━━━━\n• *Usuário:* @${sender.split('@')[0]}\n• *Sugestão:* ${q}\n• *Sistema:* Bot Seraphina`,
          mentions: [sender],
        }, { quoted: info });

        break;

      case "sorteio":
        if (!isGroup) {
          await mandar("❌ Este comando só pode ser usado em grupos.");
          break;
        }
        const groupMeta = await client.groupMetadata(from);
        const participantes = groupMeta.participants.filter(p => !p.id.endsWith("g.us"));
        const sorteado = participantes[Math.floor(Math.random() * participantes.length)];
        await client.sendMessage(from, {
          text: `🎲 Sorteado: @${sorteado.id.split("@")[0]}`,
          mentions: [sorteado.id]
        }, { quoted: info });
        break;

      // Dica de estudo aleatória
      case "dica":
        const dicas = [
          "📚 Faça resumos dos conteúdos para fixar melhor o aprendizado.",
          "⏰ Estude um pouco todos os dias, não deixe para a última hora.",
          "💤 Durma bem antes das provas, o sono ajuda na memória.",
          "📝 Resolva exercícios antigos para praticar.",
          "🎧 Ouça músicas calmas enquanto revisa a matéria.",
          "🤓 Explique a matéria para alguém, isso ajuda a entender melhor.",
          "📅 Use uma agenda para organizar suas tarefas e prazos.",
          "🍎 Faça pausas curtas durante os estudos para descansar a mente."
        ];
        const dica = dicas[Math.floor(Math.random() * dicas.length)];
        await mandar(dica);
        break;

      // Consulta feriados nacionais do Brasil
      case "feriados":
        try {
          const ano = new Date().getFullYear();
          const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
          const feriados = await res.json();
          let msg = `🇧🇷 *Feriados Nacionais de ${ano}:*\n\n`;
          feriados.forEach(f => {
            msg += `📅 ${f.date} - ${f.name}\n`;
          });
          await mandar(msg);
        } catch {
          await mandar("❌ Não foi possível obter os feriados nacionais.");
        }
        break;

      case 'criador':
        try {
          // Caminho da imagem do criador
          const imgPath = './data/img/criador.jpg';

          // Verifica se a imagem existe
          if (!fs.existsSync(imgPath)) {
            return mandar2('❌ A imagem do criador não foi encontrada.');
          }

          // Envia a imagem com a bio como legenda
          await client.sendMessage(from, {
            image: fs.readFileSync(imgPath),
            caption:
              `👋 Olá, eu sou o criador do bot Seraphina! Aqui estão algumas informações sobre mim:

👤 *Nome:* ＫＭＯＤＳ 💭

🧸 *Informações:*  
Olá, querido(a) usuário(a)! Me chamo *Kmods* (Kennedy), sou desenvolvedor fullstack com foco atual em bots. Estou na área há mais de 1 ano, tenho 18 anos e sou apaixonado por cachorros e gatos 🐶🐱.
Agradeço por confiar em mim para cuidar do seu grupo. Até logo, e um abraço do Kmods! 🫂

🌐 *Função:* Desenvolvedor de bots e Desenvolvedor web.

📷 *Instagram:* https://instagram.com/kennedy001_

💬 Entre em contato para parcerias, suporte ou ideias!`
          }, { quoted: info });

          // Envia o contato do criador em seguida
          const contactMessage = generateWAMessageFromContent(from, proto.Message.fromObject({
            contactMessage: {
              displayName: "ＫＭＯＤＳ 💭",
              vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;;;ＫＭＯＤＳ 💭;\nFN:ＫＭＯＤＳ 💭\nitem1.TEL:+556981134127\nitem1.X-ABLabel:Celular\nEND:VCARD`
            }
          }), { userJid: from, quoted: info });

          await client.relayMessage(from, contactMessage.message, { messageId: contactMessage.key.id });

        } catch (err) {
          console.error(err);
          mandar2('❌ Erro ao enviar as informações do criador.');
        }
        break;

      //================================================================\\

      //Comandos do dono
      case 'grupos':
        const gruposLista = lerJSON("./data/grupos.json");
        if (gruposLista.length === 0) return mandar2("❌ Nenhum grupo cadastrado ainda.");

        let texto = `📋 Lista de grupos cadastrados:\n\n`;
        for (const grupo of gruposLista) {
          texto += `#️⃣ *${grupo.id}*\n`;
          texto += `🆔 *${grupo.grupoId}*\n`;
          texto += `📛 *Nome:* ${grupo.nome}\n`;
          texto += `👤 *Adicionado por:* ${grupo.adicionadoPor}\n`;
          texto += `📅 *Entrei em:* ${grupo.dataEntrada}\n\n`;
        }

        client.sendMessage(from, { text: texto }, { quoted: info });
        break;


      case 'rmgp':
        if (!q || isNaN(q)) return mandar2(`❌ Informe o número do grupo na lista. Ex: *${p}removergrupo 2*`);

        let grupos = lerJSON('./data/grupos.json');
        const index = parseInt(q) - 1;

        if (index < 0 || index >= grupos.length) {
          return mandar2(`❌ Número inválido. Use *${p}grupos* para ver a lista.`);
        }

        const grupo = grupos[index];

        try {
          await client.groupLeave(grupo.grupoId);
          grupos.splice(index, 1); // Remove da lista
          salvarGruposOrdenados(grupos); // Reorganiza e salva
          mandar2(`✅ Sai do grupo e removi da lista com sucesso.`);
        } catch (err) {
          console.error(err);
          mandar2(`⚠️ Não consegui sair do grupo, mas removi do JSON.`);
          grupos.splice(index, 1);
          salvarGruposOrdenados(grupos);
        }
        break;



      case 'join':
        if (!q) return mandar2(`❌ Envie o link do grupo. Ex: ${p}join https://chat.whatsapp.com/xxxxxxxxxxxxxxx`);

        const match = q.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/);
        if (!match || !match[1]) return mandar2('❌ Link inválido! Certifique-se de que seja um link completo do WhatsApp.');

        const inviteCode = match[1];

        try {
          await client.groupAcceptInvite(inviteCode);
          mandar2(`✅ Entrei no grupo com sucesso!`);
        } catch (err) {
          console.error(err);
          mandar2('❌ Não consegui entrar no grupo. Verifique se:\n- O link está correto\n- O grupo ainda existe\n- O link não foi revogado\n- O bot está autorizado a entrar');
        }
        break;

      case "ia_sistema":
        const dados = ["grupo", "status"];
        const conteudo = body.trim();
        const valor_gp = conteudo.replace("!ia", "").trim();
        const valor_final_gp = valor_gp;
        getModoGrupoJson(from, (modoGrupo) => {
          function Resp(loc) {
            if (loc === "grupo") {
              return iaDB.grupo.replace("{modoGrupo}", `${modoGrupo}`);
            } else if (loc === "status") {
              return iaDB.status.replace("{status}", `*status OK*`);
            }
            return "";
          }
          if (dados.includes(valor_final_gp)) {
            mandar("Aguarde, estou processando a informação...");
            setTimeout(() => {
              mandar(Resp(valor_final_gp));
            }, 5000);
          } else {
            client.sendMessage(
              from,
              {
                text: "Ola, erro encontrado!. Tente novamente em alguns minutos, caso o erro persista entre em contato com o adm.",
              },
              { quoted: info }
            );
          }
        });
        break;
      //================================================================\\

      //Area reservada
    }
  });
}

startBot();
