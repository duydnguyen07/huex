FROM arm32v7/node:lts-buster

RUN apt-get update && apt-get install net-tools

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000
CMD [ "npm", "run", "start:prod" ]