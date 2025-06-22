const express = require('express');
const path = require('path');
const cors = require('cors');
__path = process.cwd();

const app = express();
const PORT =  process.env.PORT || 8080;

// ✅ Habilita CORS para todas as origens
app.use(cors());

// ✅ Permitir JSON no corpo das requisições POST/PUT
app.use(express.json());

// ✅ Importando as rotas da API
const apiRoutes = require('./apis');

// ✅ Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Usar as rotas da API
app.use(apiRoutes);

// ✅ Rota para a página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor online!\n\nServidor rodando na porta ${PORT}`);
});
