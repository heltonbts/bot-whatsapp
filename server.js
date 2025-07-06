const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");

const app = express();
app.use(express.json());

// Variáveis globais para armazenar a instância do socket e o status da conexão
let sock;
let qrCodeBase64;
let connectionStatus = "connecting";

/**
 * Função principal que gerencia a conexão com o WhatsApp.
 */
async function connectToWhatsApp() {
  // 'baileys_auth_info' é a pasta onde a sessão será salva.
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info");

  console.log("🔌 Iniciando conexão com o WhatsApp...");

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: Browsers.macOS("Desktop"),
  });

  // Gerenciador de eventos da conexão
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("✔️ QR Code recebido, escaneie abaixo:");
      // Gera o QR Code diretamente no terminal
      qrcode.generate(qr, { small: true });
      qrCodeBase64 = qr;
    }

    if (connection === "close") {
      connectionStatus = "disconnected";
      const shouldReconnect =
        (lastDisconnect.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log(
        "❌ Conexão fechada. Motivo:",
        lastDisconnect.error,
        ", reconectando:",
        shouldReconnect
      );

      if (shouldReconnect) {
        connectToWhatsApp();
      } else {
        console.log(
          '🛑 Deslogado permanentemente. Remova a pasta "baileys_auth_info" para gerar um novo QR Code.'
        );
      }
    } else if (connection === "open") {
      connectionStatus = "connected";
      console.log("✅ Conexão aberta e pronta para uso!");
    }
  });

  // Salva as credenciais sempre que forem atualizadas
  sock.ev.on("creds.update", saveCreds);

  // Gerenciador de recebimento de mensagens (opcional, para exemplo)
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe && m.type === "notify") {
      const sender = msg.key.remoteJid;
      const messageText =
        msg.message?.conversation || msg.message?.extendedTextMessage?.text;

      console.log(`💬 Mensagem recebida de ${sender}: "${messageText}"`);

      if (messageText?.toLowerCase() === "oi") {
        await sock.sendMessage(sender, {
          text: "Olá! 👋 Bot com Baileys funcionando!",
        });
      }
    }
  });
}

/**
 * Configura e inicia o servidor Express para a API.
 */
function startExpressServer() {
  const PORT = 3000;

  app.get("/status", (req, res) => {
    res.status(200).json({
      status: "success",
      connection: connectionStatus,
    });
  });

  app.post("/enviar-mensagem", async (req, res) => {
    const { to, message } = req.body;

    if (connectionStatus !== "connected") {
      return res
        .status(409)
        .json({ status: "error", message: "WhatsApp não está conectado." });
    }

    if (!to || !message) {
      return res
        .status(400)
        .json({
          status: "error",
          message: 'Campos "to" e "message" são obrigatórios.',
        });
    }

    const formattedNumber = to.includes("@s.whatsapp.net")
      ? to
      : `${to.replace(/\D/g, "")}@s.whatsapp.net`;

    try {
      // Verifica se o número existe no WhatsApp antes de enviar
      const [result] = await sock.onWhatsApp(formattedNumber);

      if (!result?.exists) {
        return res
          .status(404)
          .json({
            status: "error",
            message: "O número de destino não existe no WhatsApp.",
          });
      }

      // Envia um "ping" de presença para estabelecer/validar a sessão de criptografia
      console.log(`Pinging ${formattedNumber} para estabelecer a sessão...`);
      await sock.sendPresenceUpdate("available", formattedNumber);

      // Uma pequena pausa para garantir que a presença seja processada
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log(`Enviando a mensagem de texto para ${formattedNumber}...`);
      await sock.sendMessage(formattedNumber, { text: message });

      res.status(200).json({ status: "success", message: "Mensagem enviada!" });
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem:", error);
      res
        .status(500)
        .json({
          status: "error",
          message: "Falha ao enviar a mensagem.",
          error: error.message,
        });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor Express rodando na porta ${PORT}.`);
  });
}

// --- PONTO DE PARTIDA DA APLICAÇÃO ---
connectToWhatsApp();
startExpressServer();
