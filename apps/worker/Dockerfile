FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json eslint.config.mjs ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config-typescript/package.json packages/config-typescript/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

COPY apps/worker apps/worker
COPY packages/config-typescript packages/config-typescript
RUN pnpm --filter @lms/worker build

CMD ["pnpm", "--filter", "@lms/worker", "start"]
