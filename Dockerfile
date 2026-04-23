FROM node:24 AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
RUN npm install

COPY . .
RUN npm run build --workspace swagger-sentinel

# Final image
FROM node:24

WORKDIR /app

# Only need production dependencies in final image
COPY packages/core/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/packages/core/dist ./dist

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
