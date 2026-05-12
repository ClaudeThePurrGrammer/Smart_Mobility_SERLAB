FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 8081 19000 19001

ENV EXPO_NO_DOTENV=1

CMD ["npx", "expo", "start", "--lan", "--no-dev", "--minify"]
