FROM node:25-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

COPY .env* /app/

EXPOSE 3000

CMD ["pnpm", "start"]
