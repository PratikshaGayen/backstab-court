FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml ./

# Copy package.json files for all packages
COPY shared/package.json ./shared/
COPY server/package.json ./server/

# Install all dependencies
RUN pnpm install

# Copy source files
COPY shared/ ./shared/
COPY server/ ./server/
COPY contract/content/ ./contract/content/

# Build shared first, then server
RUN pnpm --filter @backstab/shared build
RUN pnpm --filter @backstab/server build

EXPOSE 4100

CMD ["pnpm", "--filter", "@backstab/server", "start"]