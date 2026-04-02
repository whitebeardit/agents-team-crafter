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
# Coolify injeta build-args com localhost; sanitizar para defaults HTTPS (ALLOW_LOCALHOST_API=true mantém URLs locais)
RUN set -e; \
  APP="$NEXT_PUBLIC_APP_URL"; \
  API="$NEXT_PUBLIC_API_URL"; \
  if [ "$ALLOW_LOCALHOST_API" != "true" ]; then \
    if echo "$APP" | grep -qE 'localhost|127\.0\.0\.1'; then \
      echo "WARN: NEXT_PUBLIC_APP_URL contained localhost; using https://myteams.whitebeard.dev"; \
      APP="https://myteams.whitebeard.dev"; \
    fi; \
    if echo "$API" | grep -qE 'localhost|127\.0\.0\.1'; then \
      echo "WARN: NEXT_PUBLIC_API_URL contained localhost; using https://api.myteams.whitebeard.dev/api/v1"; \
      API="https://api.myteams.whitebeard.dev/api/v1"; \
    fi; \
  fi; \
  export NEXT_PUBLIC_APP_URL="$APP" NEXT_PUBLIC_API_URL="$API"; \
  npm run build

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
