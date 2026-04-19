# Мінімальний образ лише для Hub API (Railway / Docker).
# Збірка: docker build -f Dockerfile.api -t hub-api .
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server ./server
# Потрібен для `npm run db:migrate` (release-stage міграції).
COPY scripts ./scripts

ENV NODE_ENV=production
# tsx loader потрібен тому, що server/lib/* тепер .ts (див. PR #311);
# імпорти з .js-модулів виду `from "./foo.js"` tsx резолвить на .ts.
CMD ["node", "--import", "tsx", "server/index.js"]
