# Fase de construcción
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Fase de producción
FROM nginx:alpine
# Copiar la configuración personalizada de nginx
COPY nginx.config /etc/nginx/conf.d/default.conf
# Copiar los archivos de construcción de React
COPY --from=build /app/build /usr/share/nginx/html
# Copiar la página de error personalizada
COPY public/50x.html /usr/share/nginx/html/50x.html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]