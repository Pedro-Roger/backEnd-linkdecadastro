# Modulo de Atendimento com Agentes

## Base unica de atendimento

O modulo de atendimento fica organizado em tres camadas centrais:

1. `Contact`
   - identidade do remetente
   - telefone ou provider uid
   - foto de perfil
   - dados de CRM e cadastro

2. `Conversation`
   - fio operacional do contato em um canal
   - modo de atendimento atual
   - agente vinculado
   - resumo de memoria e intencao

3. `Message`
   - historico completo da conversa
   - direcao
   - conteudo
   - midia
   - remetente
   - status

No projeto atual:

- `chat_conversations` continua sendo a base relacional do atendimento
- `chat_messages` continua sendo o historico oficial
- `service_agent_routes` passa a guardar a orquestracao por conversa
- `service_agents` passa a guardar os agentes publicados na conta

## Modos de atendimento

Cada conversa pode operar em um dos tres modos:

- `HUMAN`
  - apenas humano responde
  - IA nao responde automaticamente

- `COPILOT`
  - IA pode analisar e sugerir
  - nao responde automaticamente no canal

- `AUTONOMOUS`
  - IA responde automaticamente
  - exige agente vinculado

## Entidades introduzidas

### service_agents

Colecao gerenciada pelo backend para representar agentes especialistas.

Campos principais:

- `id`
- `owner_user_id`
- `name`
- `slug`
- `description`
- `module`
- `model`
- `instructions`
- `knowledge_base`
- `is_active`
- `tools[]`
- `allowed_channel_ids[]`
- `default_mode`
- `provider`
- `provider_agent_id`
- `created_at`
- `updated_at`

### service_agent_routes

Colecao que controla como cada conversa deve ser tratada.

Campos principais:

- `id`
- `conversation_id`
- `channel_id`
- `provider_uid`
- `mode`
- `agent_id`
- `memory_summary`
- `last_intent`
- `updated_by_user_id`
- `created_at`
- `updated_at`

## Router de atendimento

Fluxo padrao:

1. mensagem entra pelo canal
2. conversa e mensagem sao persistidas
3. router resolve a rota da conversa
4. verifica o modo:
   - `HUMAN`: nao chama auto resposta
   - `COPILOT`: prepara contexto, mas nao envia
   - `AUTONOMOUS`: chama o agente vinculado
5. agente recebe:
   - contexto do contato
   - historico recente
   - resumo operacional
   - intencao mais recente
   - ferramentas habilitadas
6. resposta e acoes voltam para o historico

## Ferramentas previstas

O cadastro inicial de agentes trabalha com uma lista controlada de tools:

- `contact.lookup`
- `conversation.history`
- `crm.note.create`
- `task.create`
- `task.list`
- `pipeline.move`
- `whatsapp.send`
- `event.lookup`
- `course.lookup`
- `human.handoff`

## Endpoints implementados

### Agents

- `GET /admin/agents/tools`
- `GET /admin/agents`
- `POST /admin/agents`
- `GET /admin/agents/:agentId`
- `PATCH /admin/agents/:agentId`

### Router de conversa

- `GET /admin/agents/routes/list`
- `GET /admin/agents/routes/:conversationId`
- `PUT /admin/agents/routes/:conversationId`

## Integracao com WhatsApp

O fluxo de WhatsApp agora respeita o router:

- conversa em `HUMAN`: sem resposta automatica
- conversa em `COPILOT`: sem resposta automatica
- conversa em `AUTONOMOUS`: resposta automatica usando o agente vinculado

As listas de chats tambem podem expor:

- `attendanceMode`
- `assignedAgentId`
- `assignedAgentName`

## Evolucao recomendada

Proximos passos naturais:

1. UI para gerenciar agentes
2. UI para trocar o modo da conversa
3. sugestao de resposta em modo copilot
4. execucao real de tools por agent runner
5. memoria consolidada por contato
6. marketplace de agentes
