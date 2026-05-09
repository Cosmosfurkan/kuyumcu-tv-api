FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

# Run with tsx; Hono is small enough that compile step is unnecessary.
RUN npm install -D tsx --no-audit --no-fund

ENV NODE_ENV=production
ENV PORT=8787
ENV LOG_LEVEL=quiet
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s \
  CMD wget -q -O- http://localhost:8787/api/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
