FROM node:18 AS build
WORKDIR /app

RUN npm cache clean --force

COPY package*.json ./
RUN npm install --silent

COPY . .
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache curl
COPY nginx.config /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
COPY public/50x.html /usr/share/nginx/html/50x.html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]