# syntax=docker/dockerfile:1.7
FROM node:lts-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /home/api-app

# GIT_SHA vira o release do Sentry — só rótulo, não afeta o build em si.
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}

# `shared/` faz parte deste repo (não é mais um repositório separado), então
# o contexto de build é a raiz do repo inteira — sem clone remoto, sem token.
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod

COPY . .

# A imagem é o ambiente de produção. Também é o que LIGA o envio ao Sentry: o
# `instrument.mjs` só chama o `init()` com `NODE_ENV=production`, então em
# localhost (onde a variável não existe) erro de desenvolvimento não sobe.
#
# O `environment:` do stack do Swarm repete a variável — lá é a fonte de
# verdade do deploy; aqui é o default de quem rodar a imagem direto.
ENV NODE_ENV=production

# `--import` carrega o Sentry ANTES de qualquer módulo da aplicação.
#
# O SDK instrumenta o Express por monkey-patching: se o Express já estiver em
# cache quando o `init()` rodar, os erros chegam sem nome de rota e sem spans.
# Em ESM o `import` é hoisted, então a primeira linha do app.js não garante a
# ordem — só a flag do Node garante.
#
# Este valor precisa concordar com os scripts `dev`/`prod` do package.json.
ENTRYPOINT ["node", "--import", "./instrument.mjs", "./app.js"]
