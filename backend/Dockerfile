FROM node:18-slim

# Instalar curl para health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Crear un usuario no-root para mayor seguridad
RUN groupadd -r nodeuser && useradd -r -g nodeuser -m nodeuser

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencia
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar archivos de código fuente
COPY --chown=nodeuser:nodeuser . .

# Cambiar a usuario no-root
USER nodeuser

# Exponer puerto
EXPOSE 5000

# Comando para iniciar la aplicación
CMD ["node", "src/index.js"]