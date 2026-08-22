FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
RUN npm install --omit=dev
ENV PORT=8443
EXPOSE 8443
CMD ["node", "server.mjs"]
