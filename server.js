const express = require("express");
const venom = require("venom-bot");

// Inicializa o aplicativo Express
const app = express();
app.use(express.json());

// Variável global para armazenar a instância do cliente
let whatsappClient;

/**
 * Função principal assíncrona que orquestra a inicialização.
 */
async function start() {
  console.log("🏁 Iniciando o bot com venom-bot (ambiente Docker)...");

  try {
    whatsappClient = await venom.create(
      "sessionName",
      (base64Qr, asciiQR, attempts, urlCode) => {
        // ... (seu código de callback do QR)
      },
      (statusSession, session) => {
        // ... (seu código de callback do status)
      },
      {
        multiDevice: true,
        folderNameToken: "tokens",
        headless: true, // Em produção, mantenha 'true'
        // Adicione dumpio para logs detalhados do browser
        dumpio: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: true,
        // LISTA DE ARGUMENTOS REVISADA
        browserArgs: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // Mantido, mas shm_size é melhor
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          // Remova as flags desnecessárias ou problemáticas
          // '--disable-web-security',
          // '--disable-features=VizDisplayCompositor',
          // '--disable-extensions',
          // '--disable-plugins',
          // '--disable-images', // REMOVIDO (Potencialmente problemático)
          // '--disable-javascript', // REMOVIDO (Causa provável do erro)
          // ... e outras flags que você pode testar remover
        ],
        refreshQR: 15000,
        autoClose: 180000,
        disableSpins: true,
        disableWelcome: true,
        updatesLog: true,
        createPathFileToken: true,
      }
    );

    console.log("🤖 Cliente WhatsApp está pronto e conectado!");

    // Configura listeners para eventos importantes
    setupEventListeners();

    // Inicia o servidor Express
    startExpressServer();
  } catch (error) {
    console.error("❌ Erro fatal ao inicializar o cliente venom-bot:", error);
    process.exit(1);
  }
}

/**
 * Configura os event listeners do venom-bot
 */
function setupEventListeners() {
  // Listener para novas mensagens (opcional)
  whatsappClient.onMessage((message) => {
    if (message.body === "Hi" && !message.isGroupMsg) {
      whatsappClient.sendText(message.from, "👋 Olá! Bot está funcionando!");
    }
  });

  // Listener para status de conexão
  whatsappClient.onStateChange((state) => {
    console.log("Estado da conexão:", state);
    if (state === "CONFLICT" || state === "UNLAUNCHED") {
      console.log("❌ Conflito detectado ou cliente não iniciado");
    }
  });
}

/**
 * Configura as rotas e inicia o servidor Express.
 */
function startExpressServer() {
  const PORT = 3000;

  // Rota de health check
  app.get("/", (req, res) => {
    res.status(200).json({
      status: "success",
      message: "🚀 Servidor WhatsApp com venom-bot está no ar!",
      timestamp: new Date().toISOString(),
    });
  });

  // Rota para verificar status da conexão
  app.get("/status", async (req, res) => {
    try {
      const isConnected = await whatsappClient.isConnected();
      res.status(200).json({
        status: "success",
        connected: isConnected,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: "Erro ao verificar status",
        error: error.message,
      });
    }
  });

  // Rota para enviar mensagem
  app.post("/enviar-mensagem", async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        status: "error",
        message: 'Campos "to" e "message" são obrigatórios.',
      });
    }

    // Formata o número (remove caracteres especiais e adiciona @c.us se necessário)
    let formattedNumber = to.replace(/\D/g, ""); // Remove tudo que não é dígito

    // Adiciona código do país se não tiver (assumindo Brasil +55)
    if (!formattedNumber.startsWith("55") && formattedNumber.length === 11) {
      formattedNumber = "55" + formattedNumber;
    }

    const fullNumber = formattedNumber + "@c.us";

    try {
      // Envia a mensagem
      const result = await whatsappClient.sendText(fullNumber, message);

      res.status(200).json({
        status: "success",
        message: "Mensagem enviada com sucesso!",
        messageId: result.id,
        to: fullNumber,
      });
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem:", error);
      res.status(500).json({
        status: "error",
        message: "Falha ao enviar a mensagem.",
        error: error.message,
      });
    }
  });

  // Rota para enviar mensagem com mídia (opcional)
  app.post("/enviar-media", async (req, res) => {
    const { to, mediaUrl, caption = "" } = req.body;

    if (!to || !mediaUrl) {
      return res.status(400).json({
        status: "error",
        message: 'Campos "to" e "mediaUrl" são obrigatórios.',
      });
    }

    let formattedNumber = to.replace(/\D/g, "");
    if (!formattedNumber.startsWith("55") && formattedNumber.length === 11) {
      formattedNumber = "55" + formattedNumber;
    }
    const fullNumber = formattedNumber + "@c.us";

    try {
      const result = await whatsappClient.sendFileFromUrl(
        fullNumber,
        mediaUrl,
        "media",
        caption
      );

      res.status(200).json({
        status: "success",
        message: "Mídia enviada com sucesso!",
        messageId: result.id,
        to: fullNumber,
      });
    } catch (error) {
      console.error("❌ Erro ao enviar mídia:", error);
      res.status(500).json({
        status: "error",
        message: "Falha ao enviar a mídia.",
        error: error.message,
      });
    }
  });

  // Middleware de tratamento de erros
  app.use((error, req, res, next) => {
    console.error("❌ Erro no servidor Express:", error);
    res.status(500).json({
      status: "error",
      message: "Erro interno do servidor",
    });
  });

  // Inicia o servidor
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `🚀 Servidor Express rodando na porta ${PORT} dentro do contêiner.`
    );
  });
}

// Tratamento graceful de encerramento
process.on("SIGINT", async () => {
  console.log("🛑 Recebido SIGINT. Encerrando graciosamente...");
  if (whatsappClient) {
    await whatsappClient.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🛑 Recebido SIGTERM. Encerrando graciosamente...");
  if (whatsappClient) {
    await whatsappClient.close();
  }
  process.exit(0);
});

// Inicia a aplicação
start();
