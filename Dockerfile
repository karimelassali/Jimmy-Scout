FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["npm", "run", "start"]
