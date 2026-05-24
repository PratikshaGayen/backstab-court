FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

RUN pnpm install

COPY shared/ ./shared/
COPY server/ ./server/

RUN pnpm --filter @backstab/server build

EXPOSE 4100

CMD ["pnpm", "--filter", "@backstab/server", "start"]