'use strict';

require('dotenv').config();

const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');

const { pool, checkDatabaseConnection } = require('./config/db');
const MySQLSessionStore = require('./middleware/mysqlSessionStore');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');

const CERTIFICATE_PATH = '/home/arx-app/backends/certs/certificate.crt';
const PRIVATE_KEY_PATH = '/home/arx-app/backends/certs/private.key';
const SESSION_COOKIE_NAME = 'artistwebsite.sid';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === 'production';

const backendPort = Number.parseInt(process.env.BACKEND_PORT || '5094', 10);

if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) {
  throw new Error('BACKEND_PORT must be a valid TCP port.');
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
}

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigin =
        /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+geo-drops\.com(?::\d{1,5})?$/i;

      callback(null, allowedOrigin.test(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type'],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: '250kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '250kb' }));

app.use(healthRoutes);

const sessionStore = new MySQLSessionStore(pool);

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    },
  })
);

app.use(authRoutes);
app.use(portfolioRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

let server;

async function startServer() {
  try {
    const connected = await checkDatabaseConnection();

    if (connected === false) {
      throw new Error('Unable to connect to the MySQL database.');
    }

    const tlsOptions = {
      cert: fs.readFileSync(path.resolve(CERTIFICATE_PATH)),
      key: fs.readFileSync(path.resolve(PRIVATE_KEY_PATH)),
      minVersion: 'TLSv1.2',
    };

    server = https.createServer(tlsOptions, app);

    server.on('error', (error) => {
      console.error('HTTPS server error:', error.message);
      process.exitCode = 1;
    });

    server.listen(backendPort, '0.0.0.0', () => {
      console.log(`Artistwebsite API listening securely on port ${backendPort}`);
    });
  } catch (error) {
    console.error('Failed to start Artistwebsite API:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down Artistwebsite API.`);

  const forceExitTimer = setTimeout(() => {
    process.exit(1);
  }, 10000);

  forceExitTimer.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await pool.end();
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error.message);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

void startServer();