# Design: redirecionamento automático pro grupo + esconder cidades do formulário

Data: 2026-07-26

Este design cobre duas features pequenas e independentes, pedidas juntas mas sem dependência
entre si. Envolve os dois repositórios do projeto:

- Backend: `backEnd-linkdecadastro` (NestJS + Prisma)
- Frontend: `linkdecadastro-app` (Next.js/React)

## Feature 1 — Redirecionamento automático após inscrição

### Problema

Hoje, ao concluir a inscrição pelo formulário público (`RegistrationForm.tsx`), o usuário vê uma
tela de sucesso com um link `<a target="_blank">` para o grupo do WhatsApp
(`event.groupInviteLink`) que precisa ser clicado manualmente.

### Comportamento novo

- Escopo: **apenas** o formulário público (`RegistrationForm.tsx`, usado por
  `src/app/register/[linkId]/page.tsx` e `src/pages/RegisterByLinkPage.tsx`). O
  `EventEnrollmentModal.tsx` (inscrição estando logado, via `EventsPage.tsx`) **não** é alterado.
- Ao confirmar a inscrição com sucesso, se `groupInviteLink` estiver presente, a página navega
  imediatamente para esse link via `window.location.href = groupInviteLink` — sem tela
  intermediária, sem precisar de clique.
- Se o evento não tiver `groupInviteLink`, mantém o comportamento atual (tela de sucesso sem
  link, sem redirecionamento).
- Não há toggle de admin para isso — o redirecionamento é sempre automático quando existe link de
  grupo cadastrado no evento. Não requer nenhuma mudança de schema, DTO ou backend.

### Onde muda

- `linkdecadastro-app/src/components/forms/RegistrationForm.tsx`: no handler de sucesso do
  submit (hoje faz `setSuccess(true)`), adicionar a checagem de `groupInviteLink` e disparar o
  redirect.

## Feature 2 — Esconder cidades específicas da lista "Cidades do Formulário"

### Problema

O admin cadastra uma lista de cidades em `Event.formCities` (`[{ city, state }]`) que alimenta o
dropdown de seleção de cidade no formulário público de inscrição. Hoje a única forma de remover
uma cidade dessa lista é excluí-la, perdendo o cadastro. O admin quer poder ocultar cidades
específicas do formulário público sem perder o cadastro, podendo reexibi-las depois.

Importante: essa feature é sobre a lista **"Cidades do Formulário"** (`formCities`, lista simples
sem controle de vagas). Não afeta a lista separada **"Cidades Participantes"**
(`MunicipalityLimit`, com controle de vagas/abrir-fechar), que já tem seu próprio mecanismo de
fechamento e não é tocada por este design.

### Modelo de dados

Cada entrada de `Event.formCities` passa a aceitar um campo opcional `hidden`:

```ts
{ city: string; state: string; hidden?: boolean }
```

Não requer migration (o campo já é `Json?` no Prisma). Entradas existentes sem `hidden` são
tratadas como visíveis (`hidden` ausente/`false` = visível).

### Backend

- `UpdateEventDto.formCities`: atualizar o tipo TS para incluir `hidden?: boolean` (mantém a
  mesma validação frouxa de hoje, sem `class-validator` aninhado, consistente com o padrão atual
  desse campo).
- `AdminEventsService.updateEvent`: nenhuma mudança de lógica — o array já é salvo inteiro como
  vier (`updates.formCities = Array.isArray(formCities) ? formCities : null`), então o campo
  `hidden` passa a ser persistido automaticamente.
- **Filtragem no lado público:** `EventsService.getEventByLink` e `getEventBySlug` (endpoints
  usados pelo formulário público) devem retornar `formCities` **já filtrado**, removendo as
  entradas com `hidden: true`, antes de devolver o evento. Isso garante que a cidade oculta nunca
  chega ao cliente público, independente de qualquer lógica do frontend.
- Endpoints/telas de admin que buscam o evento para edição continuam recebendo a lista completa
  (com a flag `hidden`), para permitir reexibir a cidade depois.

### Frontend — Admin (`EditEventPage.tsx`, seção "Cidades do Formulário")

- Cada linha da lista local de `formCities` ganha um botão estilo switch (mesmo padrão visual já
  usado no toggle "Grupos do WhatsApp" — pill deslizante, não checkbox HTML) para alternar
  `hidden`/visível, sem remover a cidade da lista.
- O array completo (incluindo as ocultas, com `hidden: true`) continua sendo enviado no PATCH
  geral ao clicar em "Salvar alterações", como hoje.

### Frontend — Formulário público

- Como a filtragem acontece no backend, `RegistrationForm.tsx` e `RegisterByLinkPage.tsx` não
  precisam de nenhuma mudança de lógica — já consomem `formCities` como um array pronto para uso.
- Efeito colateral esperado: se o admin ocultar todas as cidades da lista, `formCities` chega
  vazio ao público e o formulário cai automaticamente no fluxo antigo (seleção livre de
  estado/cidade via IBGE), pois `hasFormCities` passa a ser `false`. Esse comportamento é aceito
  como esperado, não é tratado como erro.

## Fora de escopo

- `EventEnrollmentModal.tsx` (não usa `formCities`, usa IBGE direto) — não é alterado por nenhuma
  das duas features.
- Lista "Cidades Participantes" (`MunicipalityLimit`) — não ganha capacidade de esconder, mantém
  seu mecanismo atual de abrir/fechar por vagas.
- Toggle de admin para ligar/desligar o redirecionamento automático — não existe, é sempre
  automático quando há link de grupo.
