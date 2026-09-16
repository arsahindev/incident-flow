FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY . .

RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && pnpm install --frozen-lockfile

ARG API_URL=http://127.0.0.1:4000
ARG NEXT_PUBLIC_REALTIME_URL=same-origin
ENV API_URL=$API_URL
ENV NEXT_PUBLIC_REALTIME_URL=$NEXT_PUBLIC_REALTIME_URL

RUN pnpm build

FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install --no-install-recommends -y nginx \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.20.0 --activate

COPY --from=build /app /app
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY infra/docker/start.sh /usr/local/bin/incidentflow-start

RUN chmod 0555 /usr/local/bin/incidentflow-start

EXPOSE 8080

CMD ["/usr/local/bin/incidentflow-start"]
