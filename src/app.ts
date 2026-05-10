import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import session from 'express-session';
import swaggerUI from 'swagger-ui-express';
import config from 'config';
import { MainRoutes } from './routes/main.routes';
import httpCode from './constants/http-codes';
import responseWrapper from './helpers/response-wrapper';
import swaggerSetup from './api-docs/v1/swagger-setup';
import AuthRoutes from './api/v1/controllers/auth/auth.routes';
import errorHandler from './middlewares/error-handler.middleware';
import SequelizeSessionStore from './services/session.store';
import { csrfProtection } from './middlewares/csrf.middleware';
import requestIdMiddleware from './middlewares/request-id.middleware';

const app = express();

const nodeEnv = config.get('node_env') as string;
const sessionSecret = config.get('app.secretKey') as string;

const mainRoutes = new MainRoutes().router;
const authRoutes = new AuthRoutes().router;

const sessionStore = new SequelizeSessionStore();

app.use(morgan('dev'));
app.use(requestIdMiddleware);

app.use(
  cors({
    origin: process.env.BNR_APP_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  })
);

const jsonLimit = process.env.BNR_MAX_JSON_LIMIT;

app.use(express.json({ limit: jsonLimit }));

app.use(express.urlencoded({ extended: true, limit: jsonLimit }));

app.use(
  session({
    name: 'bnr.sid',
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: nodeEnv === 'production',
      maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
  })
);

app.use('/api/v1', csrfProtection);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', mainRoutes);

app.use('/api-docs/v1', swaggerUI.serve, swaggerSetup);

app.use((_req, res, _next) => {
  responseWrapper({
    status: httpCode.NOT_FOUND,
    message: 'Page / API Not Found',
    res
  });
});

app.use(errorHandler);

export default app;
