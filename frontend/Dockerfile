FROM node:20-alpine AS builder

WORKDIR /app/frontend

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine

WORKDIR /app/frontend

COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/node_modules ./node_modules
COPY --from=builder /app/frontend/package*.json ./
COPY public ./public

EXPOSE 3000

CMD ["npm", "start"]