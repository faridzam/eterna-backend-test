FROM node:24-alpine AS build
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npm run prisma:generate

COPY nest-cli.json tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev \
  && addgroup -S stockflow \
  && adduser -S stockflow -G stockflow

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

USER stockflow

EXPOSE 8000
CMD ["node", "dist/main"]