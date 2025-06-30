#!/bin/bash

echo "🚀 Preparando ambiente para WhatsApp Bot com venom-bot..."

# Cria as pastas necessárias se não existirem
echo "📁 Criando pastas necessárias..."
mkdir -p tokens logs

# Define permissões adequadas para as pastas
echo "🔐 Configurando permissões..."
chmod 755 tokens logs

# Verifica se o Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker primeiro."
    exit 1
fi

echo "✅ Ambiente preparado com sucesso!"
echo ""
echo "Para executar o bot:"
echo "  docker-compose up --build"
echo ""
echo "Para executar em background:"
echo "  docker-compose up -d --build"
echo ""
echo "Para ver os logs (incluindo QR code):"
echo "  docker-compose logs -f whatsapp-bot"
echo ""
echo "Para parar o bot:"
echo "  docker-compose down"