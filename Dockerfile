# ---------- Builder ----------
FROM node:20-bookworm AS builder
WORKDIR /app

# Instala dependências (com dev) para compilar
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copia o código e builda (prisma generate && nest build)
COPY . .
RUN npm run build

# ---------- Runner ----------
FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# tzdata para suportar TZ (ex: America/Fortaleza)
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata openssl \
  && rm -rf /var/lib/apt/lists/*

# Apenas dependências de produção
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

# Prisma Client já gerado no builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# App compilado
COPY --from=builder /app/dist ./dist

# Pasta de uploads (montada como volume em produção)
RUN mkdir -p /app/public/uploads/banners

ENV PORT=3333
ENV UPLOAD_DIR=/app/public/uploads
EXPOSE 3333

CMD ["node", "dist/main.js"]
