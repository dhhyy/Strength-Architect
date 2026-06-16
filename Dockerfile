FROM oven/bun:1.3.14 AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

FROM deps AS build

COPY . .
RUN bun run build

FROM oven/bun:1.3.14 AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock bunfig.toml vite.config.ts tsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src

EXPOSE 3000

CMD ["bun", "run", "preview", "--host", "0.0.0.0", "--port", "3000"]
