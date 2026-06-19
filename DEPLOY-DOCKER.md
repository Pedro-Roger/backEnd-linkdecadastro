# Deploy do Backend com Docker (VPS Hostinger)

Backend (NestJS) em container. MongoDB externo (Atlas) por padrão.

## Opção A — Docker Compose (recomendado)

```bash
# 1) Docker na VPS
curl -fsSL https://get.docker.com | sh

# 2) Código + env
git clone <repo-backend> backEnd-linkdecadastro
cd backEnd-linkdecadastro
cp .env.example .env
nano .env                 # DATABASE_URL, JWT_SECRET, FRONTEND_URL...

# 3) Subir
docker compose up -d --build

# logs / status
docker compose logs -f backend
docker compose ps
```

Backend na porta **3333**.

### Atualizar
```bash
git pull
docker compose up -d --build
```

## Opção B — Docker puro

```bash
docker build -t linkdecadastro-backend .
docker run -d --name backend --restart unless-stopped \
  -p 3333:3333 \
  --env-file .env \
  -e PORT=3333 -e TZ=America/Fortaleza -e UPLOAD_DIR=/app/public/uploads \
  -v linkde_uploads:/app/public/uploads \
  linkdecadastro-backend
```

## Persistência
- **Uploads**: volume `uploads` em `/app/public/uploads` (sobrevive a recriação). Se usar S3, configure as `AWS_*` no `.env`.
- **Sessões WhatsApp**: ficam no MongoDB — sobrevivem a restart.

## HTTPS / domínio
nginx/Caddy na frente para TLS → `api.seudominio.com` → porta 3333.
Ajuste `FRONTEND_URL` no `.env` (CORS) e o `API_URL` do `config.js` do frontend
para a URL pública do backend.

## MongoDB self-hosted (opcional)
Prisma exige Mongo em **replica set**: suba com `--replSet rs0`, rode
`rs.initiate()` e use:
```
DATABASE_URL=mongodb://HOST:27017/linkdecadastro?replicaSet=rs0&directConnection=true
```
