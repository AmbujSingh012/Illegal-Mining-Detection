FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN mkdir -p uploads reports

EXPOSE 5000

CMD ["npm", "start"]
