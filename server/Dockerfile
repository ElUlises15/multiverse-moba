# Servidor de Multiverse MOBA. Construir DESDE LA RAÍZ del repo (el servidor usa ../js):
#   docker build -f server/Dockerfile -t multiverse-moba-server .
#   docker run -p 8080:8080 multiverse-moba-server
FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY index.html favicon.* ./
COPY js ./js
COPY css ./css
COPY assets ./assets
COPY vendor ./vendor
COPY server/*.js ./server/
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
WORKDIR /app/server
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "server.js"]
