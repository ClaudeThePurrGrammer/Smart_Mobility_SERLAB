# Dev server Vite per la web dashboard (VIEW). Build di produzione (nginx) rimandata.
FROM node:20-alpine

WORKDIR /app

# Installa le dipendenze sfruttando la cache dei layer.
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
