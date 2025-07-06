const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { createCanvas } = require("canvas");

const dirBase = "./data/func/empresa";
const getCaminho = (from) => `${dirBase}/${from}.json`;

function lerDados(from) {
  const caminho = getCaminho(from);
  if (!fs.existsSync(caminho)) return null;
  return JSON.parse(fs.readFileSync(caminho));
}

function salvarDados(from, dados) {
  const caminho = getCaminho(from);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
}

// 🏢 Criar Empresa
function criarEmpresa(from, nome, dono) {
  const caminho = getCaminho(from);
  if (fs.existsSync(caminho)) return false;

  const novaEmpresa = {
    nome,
    dono,
    faturamento: [],
    despesas: [],
    estoque: [],
    metas: { mensal: 0 }
  };

  salvarDados(from, novaEmpresa);
  return true;
}

// 📥 Obter Empresa
function getEmpresa(from) {
  return lerDados(from);
}

// 💰 Adicionar Receita
function addFaturamento(from, valor, descricao) {
  const empresa = getEmpresa(from);
  if (!empresa) return false;

  empresa.faturamento.push({
    valor,
    descricao,
    data: new Date().toLocaleString("pt-BR")
  });

  salvarDados(from, empresa);
  return true;
}

// 🧾 Adicionar Despesa
function addDespesa(from, valor, descricao) {
  const empresa = getEmpresa(from);
  if (!empresa) return false;

  empresa.despesas.push({
    valor,
    descricao,
    data: new Date().toLocaleString("pt-BR")
  });

  salvarDados(from, empresa);
  return true;
}

// 🎯 Definir Meta Mensal
function setMetaMensal(from, valor) {
  const empresa = getEmpresa(from);
  if (!empresa) return false;

  empresa.metas.mensal = valor;
  salvarDados(from, empresa);
  return true;
}

// ➕ Adicionar Produto ao Estoque (com preço de compra incluso)
function addProdutoEstoque(from, nome, quantidade, precoVenda, precoCompra) {
  const empresa = getEmpresa(from);
  if (!empresa) return false;

  const existente = empresa.estoque.find(p => p.nome.toLowerCase() === nome.toLowerCase());
  if (existente) {
    existente.quantidade += quantidade;
    existente.preco = precoVenda;
    existente.precoCompra = precoCompra;
  } else {
    empresa.estoque.push({
      nome,
      quantidade,
      preco: precoVenda,
      precoCompra: precoCompra
    });
  }

  salvarDados(from, empresa);
  return true;
}

// 💸 Registrar Venda (para relatórios e exportações)
function registrarVenda(from, produto, receita, custo, responsavel) {
  let vendas = lerDados(from);
  if (!vendas) return null;

  const lucro = receita - custo;
  const nova = {
    id: (vendas.faturamento?.length || 0) + 1,
    data: new Date().toLocaleDateString("pt-BR"),
    produto,
    receita,
    custo,
    lucro,
    responsavel
  };

  return nova;
}

// 📊 Resumo financeiro de vendas
function resumoFinanceiro(from) {
  const empresa = getEmpresa(from);
  if (!empresa) return { vendasTotais: 0, receita: 0, custo: 0, lucro: 0 };

  const receita = empresa.faturamento.reduce((t, v) => t + (v.valor || 0), 0);
  const custo = empresa.despesas.reduce((t, v) => t + (v.valor || 0), 0);
  const lucro = receita - custo;
  return { vendasTotais: empresa.faturamento.length, receita, custo, lucro };
}

// 📈 Exportar Excel
async function exportarExcel(from, caminhoFinal) {
  const empresa = getEmpresa(from);
  if (!empresa) return;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Financeiro");

  sheet.columns = [
    { header: "ID", key: "id" },
    { header: "Produto", key: "produto" },
    { header: "Receita", key: "receita" },
    { header: "Custo", key: "custo" },
    { header: "Lucro", key: "lucro" },
    { header: "Responsável", key: "responsavel" },
    { header: "Data", key: "data" },
  ];

  empresa.faturamento.forEach((f, i) => {
    const despesa = empresa.despesas[i];
    const custo = despesa?.valor || 0;
    const lucro = f.valor - custo;

    sheet.addRow({
      id: i + 1,
      produto: f.descricao,
      receita: f.valor,
      custo,
      lucro,
      responsavel: empresa.dono,
      data: f.data
    });
  });

  await workbook.xlsx.writeFile(caminhoFinal);
  return caminhoFinal;
}

// 🧾 Exportar PDF

function exportarPDF(from, caminhoFinal) {
  return new Promise((resolve, reject) => {
    const empresa = getEmpresa(from);
    if (!empresa) return reject(new Error("Empresa não encontrada."));

    const dados = empresa.faturamento || [];
    const resumo = resumoFinanceiro(from);

    fs.mkdirSync(path.dirname(caminhoFinal), { recursive: true });

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(caminhoFinal);
    doc.pipe(stream);

    // 🔰 Cabeçalho
    doc.fontSize(18).text(" Relatório Financeiro", { align: "center", underline: true });
    doc.moveDown(1.2);

    doc.fontSize(12)
      .text(` Empresa: ${empresa.nome}`)
      .text(` Dono: ${empresa.dono}`)
      .text(` Gerado em: ${new Date().toLocaleDateString("pt-BR")}`);
    doc.moveDown();

    // 📊 Totais
    doc.fontSize(14).text(" Resumo Geral", { underline: true });
    doc.fontSize(12)
      .text(` Total de Vendas: ${resumo.vendasTotais}`)
      .text(` Receita Total: R$ ${resumo.receita.toFixed(2)}`)
      .text(` Custo Total: R$ ${resumo.custo.toFixed(2)}`)
      .text(` Lucro Total: R$ ${resumo.lucro.toFixed(2)}`);
    doc.moveDown(1.2);

    // 🧾 Lista de Vendas
    doc.fontSize(14).text(" Detalhes das Vendas", { underline: true });
    doc.moveDown();

    if (dados.length === 0) {
      doc.fontSize(12).text(" Nenhuma venda registrada.");
    } else {
      dados.forEach((venda, i) => {
        doc.fontSize(12)
          .text(` Venda #${venda.id}`)
          .text(` Descrição: ${venda.descricao || venda.produto || '---'}`)
          .text(` Data: ${venda.data || '---'}`)
          .text(` Receita: R$ ${venda.valor?.toFixed?.(2) || venda.receita?.toFixed?.(2) || '0.00'}`)
          .text(` Custo: R$ ${venda.custo?.toFixed?.(2) || '---'}`)
          .text(` Responsável: ${venda.responsavel || '---'}`);
        doc.moveDown();

        // Linha separadora
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#ccc").stroke();
        doc.moveDown(0.7);
      });
    }

    doc.end();

    stream.on('finish', () => resolve(caminhoFinal));
    stream.on('error', reject);
  });
}



// 🧁 Gráfico de Pizza (Dashboard)
function gerarGraficoPizza(from, caminhoFinal) {
  const empresa = getEmpresa(from);
  if (!empresa) return;

  const receita = empresa.faturamento.reduce((t, v) => t + v.valor, 0);
  const despesa = empresa.despesas.reduce((t, v) => t + v.valor, 0);
  const lucro = receita - despesa;

  const canvas = createCanvas(600, 400);
  const ctx = canvas.getContext("2d");

  // Fundo branco
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 600, 400);

  // Título
  ctx.fillStyle = "#000";
  ctx.font = "26px Arial";
  ctx.fillText("Dashboard Financeiro", 180, 40);

  const total = receita + despesa + Math.max(lucro, 0);
  const sliceValues = [
    { label: "Receita", value: receita, color: "#4caf50" },
    { label: "Despesa", value: despesa, color: "#f44336" },
    { label: "Lucro", value: lucro > 0 ? lucro : 0, color: "#2196f3" },
  ];

  let startAngle = 0;
  const centerX = 200;
  const centerY = 220;
  const radius = 140;

  sliceValues.forEach(({ label, value, color }, i) => {
    const sliceAngle = (value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    const legendX = 380;
    const legendY = 100 + i * 40;
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY, 30, 30);
    ctx.fillStyle = "#000";
    ctx.font = "18px Arial";
    ctx.fillText(`${label}: R$ ${value.toFixed(2)}`, legendX + 40, legendY + 22);

    startAngle += sliceAngle;
  });

  fs.writeFileSync(caminhoFinal, canvas.toBuffer());
  return caminhoFinal;
}

module.exports = {
  criarEmpresa,
  getEmpresa,
  salvarDados,
  addFaturamento,
  addDespesa,
  setMetaMensal,
  addProdutoEstoque,
  registrarVenda,
  resumoFinanceiro,
  exportarExcel,
  exportarPDF,
  gerarGraficoPizza
};
