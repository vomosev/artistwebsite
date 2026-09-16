'use strict';

const session = require('express-session');
const { pool } = require('../config/db');

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

class MySQLSessionStore extends session.Store {
  constructor(options = {}) {
    super();

    this.ttlMs = this._positiveNumber(options.ttlMs, DEFAULT_TTL_MS);
    this.cleanupIntervalMs = this._positiveNumber(
      options.cleanupIntervalMs,
      DEFAULT_CLEANUP_INTERVAL_MS
    );

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired((error) => {
        if (error) {
          console.error('Failed to clean up expired sessions.');
        }
      });
    }, this.cleanupIntervalMs);

    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }

    this.cleanupExpired((error) => {
      if (error) {
        console.error('Failed to perform initial expired-session cleanup.');
      }
    });
  }

  get(sessionId, callback) {
    const done = this._callback(callback);

    if (!this._isValidSessionId(sessionId)) {
      done(null, null);
      return;
    }

    pool
      .execute(
        `SELECT session_data
         FROM sessions
         WHERE session_id = ?
           AND expires_at > CURRENT_TIMESTAMP
         LIMIT 1`,
        [sessionId]
      )
      .then(([rows]) => {
        if (!rows.length) {
          done(null, null);
          return;
        }

        try {
          const storedData = rows[0].session_data;
          let sessionData;

          if (Buffer.isBuffer(storedData)) {
            sessionData = JSON.parse(storedData.toString('utf8'));
          } else if (typeof storedData === 'string') {
            sessionData = JSON.parse(storedData);
          } else if (storedData && typeof storedData === 'object') {
            sessionData = storedData;
          } else {
            throw new Error('Stored session data is invalid.');
          }

          done(null, sessionData);
        } catch (error) {
          error.code = 'SESSION_DESERIALIZATION_ERROR';
          done(error);
        }
      })
      .catch((error) => {
        done(error);
      });
  }

  set(sessionId, sessionData, callback) {
    const done = this._callback(callback);

    if (!this._isValidSessionId(sessionId)) {
      done(this._invalidSessionIdError());
      return;
    }

    let serializedSession;
    let expiresAtSeconds;

    try {
      serializedSession = JSON.stringify(sessionData);
      expiresAtSeconds = this._getExpirationSeconds(sessionData);
    } catch (error) {
      done(error);
      return;
    }

    pool
      .execute(
        `INSERT INTO sessions (session_id, session_data, expires_at)
         VALUES (?, ?, FROM_UNIXTIME(?))
         ON DUPLICATE KEY UPDATE
           session_data = VALUES(session_data),
           expires_at = VALUES(expires_at),
           updated_at = CURRENT_TIMESTAMP`,
        [sessionId, serializedSession, expiresAtSeconds]
      )
      .then(() => {
        done(null);
      })
      .catch((error) => {
        done(error);
      });
  }

  destroy(sessionId, callback) {
    const done = this._callback(callback);

    if (!this._isValidSessionId(sessionId)) {
      done(null);
      return;
    }

    pool
      .execute('DELETE FROM sessions WHERE session_id = ?', [sessionId])
      .then(() => {
        done(null);
      })
      .catch((error) => {
        done(error);
      });
  }

  touch(sessionId, sessionData, callback) {
    const done = this._callback(callback);

    if (!this._isValidSessionId(sessionId)) {
      done(this._invalidSessionIdError());
      return;
    }

    let expiresAtSeconds;

    try {
      expiresAtSeconds = this._getExpirationSeconds(sessionData);
    } catch (error) {
      done(error);
      return;
    }

    pool
      .execute(
        `UPDATE sessions
         SET expires_at = FROM_UNIXTIME(?),
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = ?`,
        [expiresAtSeconds, sessionId]
      )
      .then(() => {
        done(null);
      })
      .catch((error) => {
        done(error);
      });
  }

  cleanupExpired(callback) {
    const done = this._callback(callback);

    pool
      .execute('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP')
      .then(([result]) => {
        done(null, result.affectedRows || 0);
      })
      .catch((error) => {
        done(error);
      });
  }

  cleanupExpiredSessions(callback) {
    this.cleanupExpired(callback);
  }

  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  _getExpirationSeconds(sessionData) {
    const cookie = sessionData && sessionData.cookie ? sessionData.cookie : {};
    let expiresAt;

    if (cookie.expires) {
      expiresAt = new Date(cookie.expires);

      if (Number.isNaN(expiresAt.getTime())) {
        throw new TypeError('Session cookie expiration is invalid.');
      }
    } else {
      const maxAge = this._positiveNumber(
        cookie.originalMaxAge || cookie.maxAge,
        this.ttlMs
      );
      expiresAt = new Date(Date.now() + maxAge);
    }

    return Math.ceil(expiresAt.getTime() / 1000);
  }

  _callback(callback) {
    const handler = typeof callback === 'function' ? callback : () => {};

    return (...args) => {
      process.nextTick(handler, ...args);
    };
  }

  _positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  _isValidSessionId(sessionId) {
    return (
      typeof sessionId === 'string' &&
      sessionId.length > 0 &&
      sessionId.length <= 128
    );
  }

  _invalidSessionIdError() {
    const error = new TypeError('A valid session identifier is required.');
    error.code = 'INVALID_SESSION_ID';
    return error;
  }
}

module.exports = MySQLSessionStore;