# Pin by digest for supply-chain Scorecard (Pinned-Dependencies).
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32
WORKDIR /app
COPY package.json server.mjs ./
RUN npm install --omit=dev
ENV PORT=8443
EXPOSE 8443
# TLS: mount certs and set TLS_CERT / TLS_KEY (installer does this).
CMD ["node", "server.mjs"]
