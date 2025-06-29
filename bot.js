const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadContentFromMessage,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const Tesseract = require("tesseract.js");
const axios = require("axios");
const readline = require("readline");
const frasesMotivacionais = require("./Motivation.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const youtubedl = require('youtube-dl-exec');
const search = require("yt-search");
const iaDB = JSON.parse(fs.readFileSync("./ia.json"));
const cron = require("node-cron");
const { menu } = require("./menu");
const fetch = require('node-fetch');
const { error } = require("console");
const sqlite3 = require('sqlite3').verbose();
const dadosSQL = require('./dados_sql_seraphina.js');
const db = new sqlite3.Database('./data/database/bot.db');
const botTag = "Obrigado pela preferencia!  Bot Seraphina V3";
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

// Funções SQLite
function listarTarefasSqlite(callback) {
  db.all('SELECT * FROM tarefas', [], (err, rows) => {
    if (err) return callback("Erro ao acessar o banco de dados.");
    if (!rows.length) return callback("🗒️ *Lista de Tarefas:*\n\n> Nenhuma tarefa adicionada no momento.");
    let mensagem = `╭───❍ *📑 Lista de Tarefas*\n│\n`;
    rows.forEach(tarefa => {
      mensagem += `│ 🆔 *ID:* ${tarefa.id}
│ ✍️ *Descrição:* ${tarefa.descricao}
│ 📅 *Postada:* ${tarefa.data}
│ ⏳ *Entrega:* ${tarefa.entregar}
│ ${tarefa.feita ? "✅ *Status:* Concluída" : "📋 *Status:* Pendente"}
│━━━━━━━━━━━━━━━━━\n`;
    });
    mensagem += "╰───────────────❍";
    callback(mensagem);
  });
}
function adicionarTarefaSqlite(descricao, dataEntrega, callback) {
  db.run(
    'INSERT INTO tarefas (descricao, data, entregar, feita) VALUES (?, ?, ?, 0)',
    [descricao, new Date().toLocaleDateString("pt-BR"), dataEntrega],
    function (err) {
      if (err) return callback("Erro ao adicionar tarefa.");
      callback(`Tarefa adicionada: ${descricao} (Entrega: ${dataEntrega})`);
    }
  );
}
function marcarTarefaComoFeitaSqlite(id, callback) {
  db.run('UPDATE tarefas SET feita = 1 WHERE id = ?', [id], function (err) {
    if (err) return callback("Erro ao marcar tarefa como feita.");
    callback(`Tarefa #${id} marcada como feita.`);
  });
}
function listarLembretesSqlite(from, callback) {
  db.all('SELECT * FROM lembretes WHERE local = ?', [from], (err, rows) => {
    if (err) return callback("Erro ao acessar o banco de dados.");
    if (!rows.length) return callback("⚠️ Nenhum lembrete encontrado para este chat.");
    let msg = `📜 *Lembretes deste chat:*\n\n`;
    rows.forEach((l) => {
      msg += `🆔 *ID:* ${l.id}\n📝  _${l.descricao}_\n`;
      if (l.tipo === "auto") {
        msg += `🔁 *Auto-lembrete:* a cada ${l.frequencia} dia(s)\n📅 *Última:* ${l.ultimaExecucao || "Nenhuma ainda"}\n`;
      } else {
        msg += `📅 *Data:* ${l.data || ""}\n⏰ *Hora:* ${l.hora || ""}\n`;
      }
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    });
    callback(msg);
  });
}
function adicionarLembreteSqlite(from, descricao, tipo, frequencia, data, hora, callback) {
  db.run(
    'INSERT INTO lembretes (descricao, local, tipo, frequencia, ultimaExecucao, data, hora, dataCriacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [descricao, from, tipo, frequencia, null, data, hora, new Date().toISOString().split("T")[0]],
    function (err) {
      if (err) return callback("Erro ao adicionar lembrete.");
      callback(`✅ Lembrete adicionado!\n\n📝 *${descricao}*\n🆔 *ID:* ${this.lastID}`);
    }
  );
}
function excluirLembretesSqlite(from, ids, callback) {
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
}
function getModoGrupoSqlite(grupoId, callback) {
  db.get('SELECT modo FROM grupos WHERE id = ?', [grupoId], (err, row) => {
    if (err || !row) return callback(null);
    callback(row.modo);
  });
}
function setModoGrupoSqlite(grupoId, nome, modo, callback) {
  db.run(
    'INSERT OR REPLACE INTO grupos (id, nome, modo) VALUES (?, ?, ?)',
    [grupoId, nome, modo],
    function (err) {
      if (err) return callback(false);
      callback(true);
    }
  );
}
function grupoCadastradoSqlite(grupoId, callback) {
  db.get('SELECT id FROM grupos WHERE id = ?', [grupoId], (err, row) => {
    callback(!!row);
  });
}
function lerFuncoesSqlite(callback) {
  db.get('SELECT autoLembrAtivo FROM funcoes', [], (err, row) => {
    if (err || !row) return callback({ autoLembrAtivo: false });
    callback({ autoLembrAtivo: !!row.autoLembrAtivo });
  });
}
function salvarFuncoesSqlite(autoLembrAtivo, callback) {
  db.run('UPDATE funcoes SET autoLembrAtivo = ?', [autoLembrAtivo ? 1 : 0], function (err) {
    if (callback) callback(!err);
  });
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
    const isGroup = info.key.remoteJid.endsWith("@g.us");
    const from = info.key.remoteJid;
    const body = info.message.conversation || info.message.extendedTextMessage?.text || "";
    const pushname = info.pushName || "Usuario sem nome";
    const args = body.slice(prefixo.length).trim().split(/ +/);
    const command = args[0].toLowerCase();
    const comando = command;
    const query = args.slice(1).join(" ").trim();
    const q = query;
    const sender = info.key.participant || info.key.remoteJid;
    const modoNumero = args[1];
    const modosMap = { 1: "empresarial", 2: "escolar", 3: "facultativo", 4: "amizade" };

    const mandar = async (conteudo) => {
      await client.sendMessage(from, { text: `${conteudo} \n\n> ${botTag}` }, { quoted: info });
    };

    // Verifica cadastro do grupo
    if (isGroup) {
      await new Promise((resolve) => {
        grupoCadastradoSqlite(from, (cadastrado) => {
          if (!cadastrado && !["cadastrar", "registrar"].includes(comando)) {
            client.sendMessage(from, {
              text: `🚫 Este grupo não está cadastrado no sistema.\n\n👉 Peça ao dono do bot para cadastrá-lo com *!cadastrar*.`,
            });
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
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
        getModoGrupoSqlite(from, (modo) => resolve(modo));
      });
    }

    switch (command) {
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
        grupoCadastradoSqlite(from, (cadastrado) => {
          if (cadastrado) {
            return client.sendMessage(from, { text: "✅ Este grupo já está cadastrado no sistema." });
          }
          client.groupMetadata(from).then((metadata) => {
            if (modoNumero && modosMap[modoNumero]) {
              setModoGrupoSqlite(from, metadata.subject, modosMap[modoNumero], (ok) => {
                client.sendMessage(from, {
                  text: `✅ Grupo cadastrado com sucesso no modo *${modosMap[modoNumero]}*!`,
                });
              });
            } else {
              setModoGrupoSqlite(from, metadata.subject, null, (ok) => {
                client.sendMessage(from, {
                  text: `✅ Grupo cadastrado com sucesso! Use o comando *!modo [número]* para definir o modo:\n\n1️⃣ Empresarial\n2️⃣ Escolar\n3️⃣ Facultativo\n4️⃣ Amizade\n\nPara alterar o modo do grupo a qualquer momento, use o comando *!modo [número]*.`,
                });
              });
            }
          });
        });
        break;

      case "add-tarefa":
        // Proteção modo restrito escolar
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
            adicionarTarefaSqlite(descricao, dataEntrega, (msg) => {
              mensagensAdicionadas.push(`- ${descricao} (Entrega: ${dataEntrega})`);
              count++;
              if (count === tarefasInput.length) {
                listarTarefasSqlite(async (mensagem) => {
                  await mandar(`Tarefas adicionadas:\n${mensagensAdicionadas.join("\n")}\n\n${mensagem}\n`);
                });
              }
            });
          });
        } else {
          await mandar(
            `*Erro: Nenhuma tarefa fornecida!*\nInstruções:\n- Para adicionar múltiplas tarefas, separe-as com ','.\n- Para cada tarefa, use '/' para separar descrição e data.\n- Exemplo: !add-tarefa tarefa1 / 30-05-2025, tarefa2 / 07-01-2024`
          );
        }
        break;

      case "feito":
        const ids = args.slice(1).map((idStr) => parseInt(idStr, 10)).filter((id) => !isNaN(id));
        if (ids.length > 0) {
          let count = 0;
          ids.forEach((id) => {
            marcarTarefaComoFeitaSqlite(id, (msg) => {
              count++;
              if (count === ids.length) {
                listarTarefasSqlite(async (mensagem) => {
                  await mandar(`Tarefas #${ids.join(", ")} marcadas como feitas ✅\n\n${mensagem}\n\n> Instruções: Para marcar múltiplas tarefas como feitas, use: !feito 1 2 3`);
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
        listarTarefasSqlite(async (mensagem) => {
          await mandar(mensagem);
        });
        break;

      case "lembretes":
        listarLembretesSqlite(from, (mensagem) => {
          client.sendMessage(from, { text: mensagem });
        });
        break;

      case "add-lembrete":
        // Proteção modo restrito escolar
        if (global.somenteAdmEscola && (await modoGrupoAtual()) === "escolar" && !sender.includes("556981134127")) {
          if (!(await podeExecutarRestrito())) {
            await mandar("❌ Apenas administradores podem adicionar lembretes no modo escolar com restrição ativada.");
            break;
          }
        }
        if (!args.length) {
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
              text: `❌ *Formato incorreto!*\n\nUse:\n!add-lembrete auto | descrição | frequência (em dias)`,
            });
            break;
          }
          adicionarLembreteSqlite(from, descricao, "auto", frequencia, null, null, (msg) => {
            client.sendMessage(from, { text: msg });
          });
        } else {
          const descricao = partes.join(" ");
          adicionarLembreteSqlite(from, descricao, "normal", null, null, null, (msg) => {
            client.sendMessage(from, { text: msg });
          });
        }
        break;

      case "del-lembrete":
        // Proteção modo restrito escolar
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
          excluirLembretesSqlite(from, args.join(" "), (resposta) => {
            client.sendMessage(from, { text: resposta });
          });
        }
        break;

      case "del-tarefa":
      case "del-tarefas":
        // Proteção modo restrito escolar
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
          let removidos = 0;
          idsArray.forEach((id, idx) => {
            db.run('DELETE FROM tarefas WHERE id = ?', [id], function (err) {
              if (!err && this.changes > 0) removidos++;
              if (idx === idsArray.length - 1) {
                if (removidos === 0) {
                  client.sendMessage(from, { text: "⚠️ Nenhuma tarefa encontrada com esses IDs." });
                } else {
                  client.sendMessage(from, { text: `🗑️ *Tarefas excluídas:* ${idsArray.join(", ")}` });
                }
              }
            });
          });
        }
        break;

      case "modo":
        if (!modoNumero || !modosMap[modoNumero]) {
          await mandar(
            `Modo inválido! Use o número correspondente:\n1️⃣ Empresarial\n2️⃣ Escolar\n3️⃣ Facultativo\n4️⃣ Amizade`
          );
          break;
        }
        client.groupMetadata(from).then((metadata) => {
          setModoGrupoSqlite(from, metadata.subject, modosMap[modoNumero], (ok) => {
            if (ok) {
              mandar(`✅ Modo do grupo definido como: *${modosMap[modoNumero]}*`);
            } else {
              mandar("Erro ao definir modo.");
            }
          });
        });
        break;

      case "menu":
        getModoGrupoSqlite(from, (modoMenu) => {
          const textoMenu = menu(prefixo, modoMenu);
          client.sendMessage(from, { text: textoMenu }, { quoted: info });
        });
        break;

      case "auto-lembr":
        if (args.length < 2) {
          await mandar(
            "❌ Por favor, use '!auto-lembr on' para ativar ou '!auto-lembr off' para desativar."
          );
          break;
        }
        const estado = args[1].toLowerCase();
        lerFuncoesSqlite((funcoesEstado) => {
          if (estado === "on") {
            if (!funcoesEstado.autoLembrAtivo) {
              salvarFuncoesSqlite(true, (ok) => {
                mandar("✅ Sistema de auto-lembrete ativado.");
              });
            } else {
              mandar("⚠️ O sistema de auto-lembrete já está ativado.");
            }
          } else if (estado === "off") {
            if (funcoesEstado.autoLembrAtivo) {
              salvarFuncoesSqlite(false, (ok) => {
                mandar("✅ Sistema de auto-lembrete desativado.");
              });
            } else {
              mandar("⚠️ O sistema de auto-lembrete já está desativado.");
            }
          } else {
            mandar(
              "❌ Comando inválido. Use '!auto-lembr on' para ativar ou '!auto-lembr off' para desativar."
            );
          }
        });
        break;

      case "musica":
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
        if (!q) {
          return client.sendMessage(from, {
            text: `❗ Use: ${prefixo + comando} nome da música`,
          }, { quoted: info });
        }
        try {
          const videoResult = await search(q);
          const video = videoResult.videos[0];
          if (!video) {
            return client.sendMessage(from, {
              text: `❌ Nenhum resultado encontrado para: "${q}"`,
            }, { quoted: info });
          }
          const { title, url, thumbnail, author, views, durationRaw, timestamp, uploadedAt, description } = video;
          const dataAgora = new Date();
          const envioBot = `${dataAgora.getDate().toString().padStart(2, '0')}/${(dataAgora.getMonth()+1).toString().padStart(2, '0')}/${dataAgora.getFullYear()} às ${dataAgora.getHours().toString().padStart(2, '0')}:${dataAgora.getMinutes().toString().padStart(2, '0')}`;
          const legenda = `
🎶 *${title}*

📄 *Descrição Completa:*
${description || 'Sem descrição disponível.'}

📺 *Canal:* ${author.name}
⏱ *Duração:* ${durationRaw || timestamp || 'Desconhecida'}
👁 *Visualizações:* ${views || 'Desconhecidas'}
📅 *Publicado no YouTube:* ${uploadedAt || 'Data indisponivel'}
🔗 *Link:* ${url}

👤 *Solicitado por:* @${pushname}
📥 *Enviado pelo bot em:* ${envioBot}

⏬ Isso pode levar alguns minutos, caso o audio seja longo aguarde, baixando o áudio...
> ${botTag}
          `.trim();
          await client.sendMessage(from, {
            image: { url: thumbnail },
            caption: legenda,
          }, { quoted: info });
          const apiUrl = `https://apiseraphina.onrender.com/api/playAudio?url=${encodeURIComponent(url)}&apikey=key_KTLU94DA`;
          const response = await fetch(apiUrl);
          if (!response.ok || !response.headers.get('content-disposition')) {
            const error = await response.json().catch(() => ({}));
            console.error("❌ Erro na API:", error);
            return client.sendMessage(from, {
              text: `❌ Erro ao processar áudio: ${error.error || 'resposta inválida'}`,
            }, { quoted: info });
          }
          const fileBuffer = await response.buffer();
          await client.sendMessage(from, {
            audio: fileBuffer,
            mimetype: 'audio/mp4',
            ptt: false,
          }, { quoted: info });
          console.log(`✅ Áudio "${title}" enviado com sucesso.`);
        } catch (err) {
          console.error("❌ Erro no comando play:", err);
          await client.sendMessage(from, {
            text: '❌ Ocorreu um erro ao processar o comando. Tente novamente.',
          }, { quoted: info });
        }
        break;
      }

      case 'gif':
        const key = "key_KTLU94DA";
        if (!key) return client.sendMessage(from, { text: 'API Key não fornecida.' });
        try {
          const res = await fetch(
            `https://apiseraphina.onrender.com/api/video-aleatorio?apikey=${key}`
          );
          if (!res.ok)
            return client.sendMessage(from, { text: 'Erro ao obter GIF.' });
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          await client.sendMessage(from, {
            video: url,
            mimetype: 'video/mp4'
          });
        } catch (err) {
          client.sendMessage(from, { text: 'Erro ao processar a requisição.' });
        }
        break;

      case "ia":
        const dados = ["grupo", "status"];
        const conteudo = body.trim();
        const valor_gp = conteudo.replace("!ia", "").trim();
        const valor_final_gp = valor_gp;
        getModoGrupoSqlite(from, (modoGrupo) => {
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
    }
  });
}

startBot();
