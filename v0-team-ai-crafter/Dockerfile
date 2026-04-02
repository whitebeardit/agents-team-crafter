# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG ALLOW_LOCALHOST_API=false
ARG NEXT_PUBLIC_APP_URL=https://myteams.whitebeard.dev
ARG NEXT_PUBLIC_API_URL=https://api.myteams.whitebeard.dev/api/v1
ARG NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=false
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=$NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS
# Evita imagem de produção com API apontada para localhost (bundle do browser). Docker local: ALLOW_LOCALHOST_API=true
RUN if [ "$ALLOW_LOCALHOST_API" != "true" ]; then \
  if echo "$NEXT_PUBLIC_API_URL" | grep -qE 'localhost|127\.0\.0\.1'; then \
    echo "ERROR: NEXT_PUBLIC_API_URL must not contain localhost or 127.0.0.1 (inlined in client). Use Coolify/https URL or build with --build-arg ALLOW_LOCALHOST_API=true for local Docker."; \
    exit 1; \
  fi; \
fi
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./
EXPOSE 3002
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3002"]
