# Microserviço de WhatsApp Web

Este módulo fornece integração com WhatsApp Web usando a biblioteca `whatsapp-web.js`.

## Configuração

O serviço é inicializado automaticamente quando o módulo é carregado. A primeira vez que for executado, será necessário escanear o QR Code para autenticação.

## Endpoints

### 1. GET `/api/whatsapp/status`

Retorna o status atual da conexão WhatsApp e o QR Code (se disponível).

**Resposta de Sucesso:**
```json
{
  "success": true,
  "status": "READY",
  "qrCode": null,
  "qrCodeBase64": null
}
```

**Status Possíveis:**
- `DISCONNECTED`: Cliente desconectado
- `CONNECTING`: Estabelecendo conexão
- `QR_CODE`: Aguardando escaneamento do QR Code
- `AUTHENTICATED`: Autenticado mas não pronto
- `READY`: Pronto para uso
- `AUTH_FAILURE`: Falha na autenticação

**Quando há QR Code:**
```json
{
  "success": true,
  "status": "QR_CODE",
  "qrCode": "código_qr_string",
  "qrCodeBase64": "data:image/png;base64,..."
}
```

### 2. POST `/api/whatsapp/criar-grupo-filtrado`

Cria um grupo WhatsApp e adiciona apenas os participantes que atendem aos critérios de filtros.

**Payload:**
```json
{
  "titulo_grupo": "Clientes VIPS - Jaguaruana",
  "participantes": [
    {
      "id_contato": "5585999999999@c.us",
      "produtor": true,
      "cidade": "Jaguaruana"
    },
    {
      "id_contato": "5588988888888@c.us",
      "produtor": false,
      "cidade": "Jaguaruana"
    },
    {
      "id_contato": "5588777777777@c.us",
      "produtor": true,
      "cidade": "Fortaleza"
    }
  ],
  "filtros": {
    "cidade": "Jaguaruana",
    "produtor": true
  }
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "grupo_id": "120363040713753177@g.us",
  "participantes_adicionados": [
    "5585999999999@c.us"
  ],
  "total_filtrados": 1,
  "total_recebidos": 3
}
```

**Lógica de Filtragem:**
- Apenas participantes que atendem **TODOS** os critérios de filtros são incluídos
- No exemplo acima, apenas o primeiro participante seria adicionado (é produtor E está em Jaguaruana)

### 3. POST `/api/whatsapp/enviar-mensagem-segmentada`

Envia mensagens individuais apenas para contatos que atendem aos critérios de filtros.

**Payload:**
```json
{
  "mensagem": "Olá! Esta é uma oferta exclusiva para produtores de Jaguaruana.",
  "participantes": [
    {
      "id_contato": "5585999999999@c.us",
      "produtor": true,
      "cidade": "Jaguaruana"
    },
    {
      "id_contato": "5588988888888@c.us",
      "produtor": false,
      "cidade": "Jaguaruana"
    }
  ],
  "filtros": {
    "produtor": true,
    "cidade": "Jaguaruana"
  }
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "mensagens_enviadas": 1,
  "mensagens_falhadas": 0,
  "total_filtrados": 1,
  "total_recebidos": 2,
  "detalhes": [
    {
      "contato": "5585999999999@c.us",
      "sucesso": true
    }
  ]
}
```

### 4. POST `/api/whatsapp/enviar-mensagem-grupo`

Envia uma mensagem para um grupo específico.

**Payload:**
```json
{
  "grupo_id": "120363040713753177@g.us",
  "mensagem": "Olá grupo, aqui está nossa novidade!"
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "mensagem_id": "true_120363040713753177@c.us_3EB0ABC123..."
}
```

## Formato de ID de Contato

Os IDs de contato devem estar no formato:
- `5585999999999@c.us` para contatos individuais
- `120363040713753177@g.us` para grupos (ou apenas o número: `120363040713753177`)

## Autenticação

Todos os endpoints requerem autenticação JWT. Certifique-se de incluir o token no header:
```
Authorization: Bearer <seu_token>
```

## Sessão Persistente

A sessão do WhatsApp é armazenada localmente no diretório `.wwebjs_auth`. Isso significa que após a primeira autenticação, não será necessário escanear o QR Code novamente, a menos que a sessão expire ou seja deletada.

## Tratamento de Erros

Todos os endpoints retornam erros no formato:
```json
{
  "success": false,
  "message": "Descrição do erro",
  "error": "Detalhes técnicos (opcional)"
}
```

Códigos HTTP:
- `200`: Sucesso
- `400`: Erro de validação (payload inválido)
- `401`: Não autenticado
- `500`: Erro interno do servidor
