import * as dotenv from 'dotenv';
dotenv.config();
import * as http from 'http';
import app from './app';
import { listenToRedisEvent } from './events/redis';
import { listenToSequelizeEvent } from './events/sequelize';

const server = http.createServer(app);

const port = process.env.PORT || 4009;

//Set up Redis event listeners
listenToRedisEvent();

//Set up Sequelize event listeners
listenToSequelizeEvent();

server.listen(port, async () => {
  // eslint-disable-next-line no-console
  console.log(`Server started on PORT ${port}`);
});
