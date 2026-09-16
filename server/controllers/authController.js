const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { normalizeEmail } = require('../utils/validators');

const BCRYPT_ROUNDS = 12;
const SESSION_COOKIE_NAME = 'artistwebsite.sid';
const DUMMY_PASSWORD_HASH =
  '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

const COOKIE_CLEAR_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'none'
};

function setPrivateResponseHeaders(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, COOKIE_CLEAR_OPTIONS);
}

function normalizeName(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ');
}

function isValidEmail(email) {
  return (
    typeof email === 'string' &&
    email.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function validateSignupInput(name, email, password) {
  const fields = {};

  if (name.length < 2) {
    fields.name = 'Name must contain at least 2 characters.';
  } else if (name.length > 120) {
    fields.name = 'Name must contain no more than 120 characters.';
  }

  if (!isValidEmail(email)) {
    fields.email = 'Enter a valid email address.';
  }

  if (typeof password !== 'string' || password.length < 8) {
    fields.password = 'Password must contain at least 8 characters.';
  } else if (Buffer.byteLength(password, 'utf8') > 72) {
    fields.password = 'Password must contain no more than 72 bytes.';
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fields.password = 'Password must contain at least one letter and one number.';
  }

  return fields;
}

function validateLoginInput(email, password) {
  const fields = {};

  if (!isValidEmail(email)) {
    fields.email = 'Enter a valid email address.';
  }

  if (typeof password !== 'string' || password.length === 0) {
    fields.password = 'Enter your password.';
  }

  return fields;
}

function sendValidationError(res, fields) {
  return res.status(400).json({
    error: 'validation_error',
    message: 'Please correct the highlighted fields.',
    fields
  });
}

function publicUser(row) {
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email)
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      resolve();
      return;
    }

    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function establishAuthenticatedSession(req, user) {
  await regenerateSession(req);
  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email
  };
  await saveSession(req);
}

async function signup(req, res, next) {
  try {
    setPrivateResponseHeaders(res);

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const name = normalizeName(body.name);
    const email = normalizeEmail(
      typeof body.email === 'string' ? body.email : ''
    );
    const password = body.password;

    const validationErrors = validateSignupInput(name, email, password);
    if (Object.keys(validationErrors).length > 0) {
      return sendValidationError(res, validationErrors);
    }

    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: 'email_in_use',
        message: 'An account with this email address already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let result;
    try {
      [result] = await pool.execute(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [name, email, passwordHash]
      );
    } catch (error) {
      if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
        return res.status(409).json({
          error: 'email_in_use',
          message: 'An account with this email address already exists.'
        });
      }

      throw error;
    }

    const user = {
      id: Number(result.insertId),
      name,
      email
    };

    await establishAuthenticatedSession(req, user);

    return res.status(201).json({
      message: 'Account created successfully.',
      user
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    setPrivateResponseHeaders(res);

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = normalizeEmail(
      typeof body.email === 'string' ? body.email : ''
    );
    const password = body.password;

    const validationErrors = validateLoginInput(email, password);
    if (Object.keys(validationErrors).length > 0) {
      return sendValidationError(res, validationErrors);
    }

    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    let passwordMatches = false;

    if (rows.length > 0) {
      passwordMatches = await bcrypt.compare(password, rows[0].password_hash);
    } else {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    }

    if (rows.length === 0 || !passwordMatches) {
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password.'
      });
    }

    const user = publicUser(rows[0]);
    await establishAuthenticatedSession(req, user);

    return res.status(200).json({
      message: 'Logged in successfully.',
      user
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    setPrivateResponseHeaders(res);
    await destroySession(req);
    clearSessionCookie(res);

    return res.status(200).json({
      message: 'Logged out successfully.'
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    setPrivateResponseHeaders(res);

    const sessionUser = req.session && req.session.user;
    const userId = Number(sessionUser && sessionUser.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      clearSessionCookie(res);
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required.'
      });
    }

    const [rows] = await pool.execute(
      'SELECT id, name, email FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (rows.length === 0) {
      await destroySession(req);
      clearSessionCookie(res);

      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required.'
      });
    }

    return res.status(200).json({
      user: publicUser(rows[0])
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  signup,
  login,
  logout,
  me
};