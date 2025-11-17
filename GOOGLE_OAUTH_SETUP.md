# 🔐 Configuração do Login com Google OAuth

## 📝 Variáveis de Ambiente Necessárias

Adicione as seguintes variáveis no arquivo `.env` do backend:

```env
# Google OAuth
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui

# URL de callback (ajuste conforme o ambiente)
# Desenvolvimento:
GOOGLE_CALLBACK_URL=http://localhost:3333/auth/google/callback

# Produção (Render.com):
GOOGLE_CALLBACK_URL=https://backend-linkdecadastro.onrender.com/auth/google/callback

# URL do frontend (para redirecionamento após login)
FRONTEND_URL=https://linkdecadastro.com.br
```

## 🔧 Configuração no Google Cloud Console

### URLs de Redirecionamento Autorizadas

Certifique-se de que as seguintes URLs estão configuradas no Google Cloud Console:

1. **Desenvolvimento:**
   - `http://localhost:3333/auth/google/callback`

2. **Produção:**
   - `https://backend-linkdecadastro.onrender.com/auth/google/callback`

### Como Configurar:

1. Acesse: https://console.cloud.google.com/
2. Vá em **APIs e Serviços** > **Credenciais**
3. Clique no seu **ID do cliente OAuth**
4. Em **URIs de redirecionamento autorizados**, adicione as URLs acima
5. Clique em **Salvar**

## 🚀 Como Funciona

1. **Usuário clica em "Entrar com Google"** no frontend
2. **Frontend redireciona** para `/auth/google` no backend
3. **Backend inicia OAuth** e redireciona para Google
4. **Usuário autoriza** no Google
5. **Google redireciona** para `/auth/google/callback` no backend
6. **Backend processa** e cria/atualiza usuário
7. **Backend redireciona** para frontend com token JWT
8. **Frontend salva** token e redireciona usuário

## 📋 Fluxo de Usuário

- **Novo usuário:** Será criado automaticamente e redirecionado para `/complete-profile`
- **Usuário existente:** Será logado diretamente e redirecionado para `/my-courses`

## ⚠️ Importante

- Usuários que fazem login pelo Google **não têm senha** (`password: null`)
- Se um usuário já existe com o mesmo email, o login do Google será vinculado à conta existente
- O avatar do Google será usado se o usuário não tiver avatar

## 🧪 Testando

1. Certifique-se de que as variáveis de ambiente estão configuradas
2. Reinicie o servidor backend
3. Acesse a página de login no frontend
4. Clique em "Entrar com Google"
5. Autorize no Google
6. Verifique se foi redirecionado corretamente

