# Imagen base con soporte para Playwright
FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# Crear directorio de la aplicación
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Crear archivo .env desde .env.example si no existe
RUN cp -n .env.example .env || true

# Exponer puertos
EXPOSE 3030

# Comando para iniciar la aplicación
CMD ["npm", "start"] 