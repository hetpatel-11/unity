FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV EVE_TELEMETRY_DISABLED=1 UNITY_SUPERVISOR_PROVIDER=openai
RUN pnpm build && pnpm build:eve
ENV UNITY_MODE=demo UNITY_STATE_PATH=/data/unity-room.json PORT=8080
EXPOSE 8080
CMD ["node", "scripts/start.mjs"]
