# Usa uma imagem base leve do Node.js
FROM node:20-slim

# Instala dependências básicas que podem ser úteis
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgbm-dev \
    libxapp-dev \
    && rm -rf /var/lib/apt/lists/*

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos de definição de pacotes
COPY package.json package-lock.json ./

# Instala as dependências do projeto
RUN npm install

# Copia o resto do código da sua aplicação
COPY . .

# Expõe a porta que o servidor Express vai usar
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "server.js"]