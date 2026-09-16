'use strict';

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

async function checkDatabaseConnection() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.ping();
    return true;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  pool,
  checkDatabaseConnection
};