# api-app

**API principal do sistema.** Porta `8810`.

É o serviço central: quase tudo que o usuário faz na aplicação (`nuxt-app`) passa por aqui. Os outros backends são satélites especializados que este orquestra.

---

## O que ela faz

| Domínio | Rotas | O que resolve |
|---|---|---|
| Autenticação | `/autenticacao` | Cadastro, login, JWT, recuperação de senha, login Google |
| Perfil | `/perfil` | Dados da conta, empresa, identidade visual, perfil público |
| Colaboradores | `/colaboradores` | Convite por e-mail, papéis e permissões dentro da conta |
| Contatos | `/contatos` | Clientes e leads |
| Projetos | `/projetos` | Projetos, etapas, vínculo com contato |
| Tarefas | `/tarefas`, `/tarefas/sessoes`, `/tarefas/templates`, `/tarefas/tags` | Tarefas, cronômetro de sessão, templates, etiquetas |
| Propostas | `/propostas`, `/propostas-modelos` | Propostas comerciais e seus modelos |
| Contratos | `/contratos`, `/contratos-modelos` | Contratos e seus modelos |
| Metas | `/metas` | Metas e acompanhamento |
| Automações | `/automacoes` | Regras "quando X acontecer, faça Y" |
| IA | `/ia`, `/gestaoia` | Geração de conteúdo e assistente |
| Notificações | `/notificacoes`, `/configuracoes/notificacoes`, `/push` | Notificações in-app e push |
| Integrações | `/integracoes` | Git (GitHub/GitLab) e Google Calendar |
| WhatsApp | `/whatsapp` | Vínculo de número e assistente por mensagem |
| E-mail | `/email`, `/email-modelos` | Disparo e modelos |
| Arquivos | `/arquivos` | Metadados dos arquivos enviados |
| Dashboard | `/dashboard` | Agregações e indicadores |
| Webhooks | `/webhooks` | Recebe eventos das APIs de documento |

---

## Arquitetura: como um request atravessa o serviço

O código segue uma separação estrita de camadas. **Toda rota percorre o mesmo caminho:**

```
requisição HTTP
    ↓
routes/          declara método, caminho e encadeia os middlewares
    ↓
middlewares/     autentica, autoriza e valida ANTES de entrar na regra
    ├── token/       token.js (JWT válido?) → token-data.js (injeta req.usuario)
    │                dono.js (o recurso é desta conta?) → permissao.js (papel permite?)
    │                conta-ativa.js (conta não está suspensa?)
    ├── deteccao/    o recurso existe? injeta o documento em req para não buscar 2x
    └── rate-limit/  limita tentativas por IP/usuário em rotas sensíveis
    ↓
validations/     valida e normaliza o payload (formato, obrigatoriedade, tipos)
    ↓
controllers/     orquestra a regra de negócio; NÃO fala com o banco direto
    ↓
repositories/    única camada que acessa o MongoDB (queries e agregações)
    ↓
shared/models/   schemas Mongoose (compartilhados entre os serviços)
```

**Regra prática:** controller não faz query, repository não tem regra de negócio, rota não tem lógica. Ao adicionar um recurso, crie os quatro arquivos com o mesmo nome (`routes/x.js`, `controllers/x.js`, `repositories/x.js`, `validations/x.js`) e registre a rota em `configs/routes.js`.

### Serviços (`services/`)

Regras que não pertencem a um único controller:

| Pasta | Responsabilidade |
|---|---|
| `acesso/` | Códigos OTP de verificação |
| `automacoes/` | Executor de automações: gatilho → ação |
| `capaProposta/` | Geração da capa visual da proposta |
| `cron/` | Tarefas agendadas (ver abaixo) |
| `crypto/` | Criptografia de credenciais e `state` do OAuth |
| `discord/` | Avisos operacionais |
| `email/` | Montagem e envio, com os templates |
| `fcm/`, `push/` | Push mobile (Firebase) e web (VAPID) |
| `git/` | Integração GitHub/GitLab, vínculo commit↔tarefa |
| `google/` | OAuth e sincronização com o Calendar |
| `metas/` | Cálculo de progresso |
| `notificacoes/` | Eventos e distribuição por canal |
| `openai/` | Chat, assistente e importação de modelos |
| `propostas/` | Renderização para HTML |
| `seguranca/` | **Sanitização de HTML** — todo conteúdo rico passa por aqui antes de virar documento público (anti-XSS) |
| `tarefas/` | Regras de recorrência |
| `whatsapp/` | Adaptador da Cloud API, ações e interpretação de mensagens |

### Tarefas agendadas

Iniciadas no boot por `app.js`:

- `notificacoesAutomaticas` — avisos de prazo e vencimento
- `avisosProativos` — sugestões baseadas no uso
- `tarefasRecorrentes` — cria as próximas ocorrências
- `googleCalendarSync` — sincroniza tarefas com o Calendar

---

## Como subir

```bash
cp .env.example .env     # preencha (cada variável está comentada lá)
pnpm install
pnpm dev                 # desenvolvimento, com reload
pnpm prod                # produção
pnpm test                # suíte Vitest
```

Precisa de um **MongoDB acessível** em `MONGO_STRING`. As integrações externas (Google, OpenAI, WhatsApp, Resend) são opcionais: sem as chaves, só os recursos correspondentes ficam indisponíveis — o serviço sobe.

---

## Dependências entre serviços

```
nuxt-app ──▶ api-app ──┬──▶ api-contrato    (gera PDF, coleta assinatura)
                       ├──▶ api-proposta    (aceite público)
                       ├──▶ api-automacao   (executa automações)
                       ├──▶ api-email       (envio transacional)
                       ├──▶ api-whatsapp    (envio de mensagem)
                       └──▶ api-upload      (arquivos)
```

Os satélites chamam a api-app de volta por `/webhooks`, autenticando com `WEBHOOK_SECRET`. As chamadas internas usam `SERVICO_SECRET`. **Esses segredos precisam ser idênticos nos dois lados** — é a causa mais comum de "funciona local e falha em produção".

---

## Segurança

- Senha com hash bcrypt + pepper (`BCRYPT_KEY`). Trocar o pepper invalida todas as senhas.
- Credenciais de integração são gravadas **criptografadas** (`ENCRYPTION_KEY` / `ENCRYPTION_SALT`). Perder a chave torna os dados já gravados irrecuperáveis.
- Todo HTML vindo do usuário passa por `services/seguranca/` antes de virar documento público.
- Rotas sensíveis (login, OTP, recuperação) têm rate limit.
- O `.env` nunca vai para o repositório; use `.env.example` como referência.
