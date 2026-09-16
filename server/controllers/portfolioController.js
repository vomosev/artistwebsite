'use strict';

const pool = require('../config/db');
const validators = require('../utils/validators');

class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = Array.isArray(details) ? details : [details];
  }
}

const PROFILE_FIELDS = {
  name: ['name', 'artist_name'],
  headline: ['headline'],
  introduction: ['introduction', 'intro'],
  biography: ['biography', 'bio'],
  practiceStatement: ['practice_statement'],
  location: ['location'],
  email: ['email', 'contact_email'],
  instagramUrl: ['instagram_url'],
  websiteUrl: ['website_url'],
  heroImageUrl: ['hero_image_url']
};

const ARTWORK_FIELDS = {
  title: ['title'],
  slug: ['slug'],
  description: ['description'],
  imageUrl: ['image_url'],
  imageAlt: ['image_alt', 'alt_text'],
  category: ['category'],
  year: ['year'],
  medium: ['medium'],
  dimensions: ['dimensions'],
  displayOrder: ['display_order', 'sort_order'],
  isPublished: ['is_published', 'published'],
  isFeatured: ['is_featured', 'featured']
};

let artworkColumnsPromise;

function quoteIdentifier(identifier) {
  if (typeof identifier !== 'string' || !/^[a-z][a-z0-9_]*$/i.test(identifier)) {
    throw new Error('Invalid database identifier.');
  }

  return `\`${identifier}\``;
}

async function getArtworkColumns() {
  if (!artworkColumnsPromise) {
    artworkColumnsPromise = pool
      .query('SHOW COLUMNS FROM `artworks`')
      .then(([rows]) => new Set(rows.map((row) => row.Field)))
      .catch((error) => {
        artworkColumnsPromise = null;
        throw error;
      });
  }

  return artworkColumnsPromise;
}

function resolveColumn(columns, candidates, required = false) {
  const column = candidates.find((candidate) => columns.has(candidate));

  if (!column && required) {
    throw new Error(`Required database column is unavailable: ${candidates[0]}`);
  }

  return column || null;
}

function valueFromAliases(source, aliases, fallback = null) {
  for (const alias of aliases) {
    if (source && Object.prototype.hasOwnProperty.call(source, alias)) {
      return source[alias];
    }
  }

  return fallback;
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function serializeProfile(row) {
  return {
    id: Number(row.id),
    name: valueFromAliases(row, PROFILE_FIELDS.name, ''),
    headline: valueFromAliases(row, PROFILE_FIELDS.headline, ''),
    introduction: valueFromAliases(row, PROFILE_FIELDS.introduction, ''),
    biography: valueFromAliases(row, PROFILE_FIELDS.biography, ''),
    practiceStatement: valueFromAliases(row, PROFILE_FIELDS.practiceStatement, ''),
    location: valueFromAliases(row, PROFILE_FIELDS.location, ''),
    email: valueFromAliases(row, PROFILE_FIELDS.email, ''),
    instagramUrl: valueFromAliases(row, PROFILE_FIELDS.instagramUrl),
    websiteUrl: valueFromAliases(row, PROFILE_FIELDS.websiteUrl),
    heroImageUrl: valueFromAliases(row, PROFILE_FIELDS.heroImageUrl),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function serializeArtwork(row) {
  const year = valueFromAliases(row, ARTWORK_FIELDS.year);
  const displayOrder = valueFromAliases(row, ARTWORK_FIELDS.displayOrder, 0);

  return {
    id: Number(row.id),
    title: valueFromAliases(row, ARTWORK_FIELDS.title, ''),
    slug: valueFromAliases(row, ARTWORK_FIELDS.slug, ''),
    description: valueFromAliases(row, ARTWORK_FIELDS.description, ''),
    imageUrl: valueFromAliases(row, ARTWORK_FIELDS.imageUrl),
    imageAlt: valueFromAliases(row, ARTWORK_FIELDS.imageAlt, ''),
    category: valueFromAliases(row, ARTWORK_FIELDS.category, ''),
    year: year === null || year === undefined || year === '' ? null : Number(year),
    medium: valueFromAliases(row, ARTWORK_FIELDS.medium, ''),
    dimensions: valueFromAliases(row, ARTWORK_FIELDS.dimensions, ''),
    displayOrder: Number.isFinite(Number(displayOrder)) ? Number(displayOrder) : 0,
    isPublished: toBoolean(valueFromAliases(row, ARTWORK_FIELDS.isPublished, false)),
    isFeatured: toBoolean(valueFromAliases(row, ARTWORK_FIELDS.isFeatured, false)),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function normalizeString(value, field, options = {}) {
  const {
    required = false,
    maxLength = 65535,
    nullable = false
  } = options;

  if (value === null && nullable) {
    return null;
  }

  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(`${field} is required.`, [{ field, message: `${field} is required.` }]);
    }

    return nullable ? null : '';
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string.`, [
      { field, message: `${field} must be a string.` }
    ]);
  }

  const normalized = value.trim();

  if (required && !normalized) {
    throw new ValidationError(`${field} is required.`, [{ field, message: `${field} is required.` }]);
  }

  if (normalized.length > maxLength) {
    throw new ValidationError(`${field} is too long.`, [
      { field, message: `${field} must not exceed ${maxLength} characters.` }
    ]);
  }

  if (!normalized && nullable) {
    return null;
  }

  return normalized;
}

function normalizeUrl(value, field) {
  const normalized = normalizeString(value, field, {
    maxLength: 2048,
    nullable: true
  });

  if (normalized === null) {
    return null;
  }

  let parsed;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new ValidationError(`${field} must be a valid URL.`, [
      { field, message: `${field} must be a valid absolute URL.` }
    ]);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ValidationError(`${field} must use HTTP or HTTPS.`, [
      { field, message: `${field} must use HTTP or HTTPS.` }
    ]);
  }

  return parsed.toString();
}

function normalizeEmail(value) {
  const normalized = normalizeString(value, 'email', {
    required: true,
    maxLength: 254
  }).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ValidationError('Email must be valid.', [
      { field: 'email', message: 'Enter a valid email address.' }
    ]);
  }

  return normalized;
}

function normalizeBoolean(value, field, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if ([true, 1, '1', 'true', 'on', 'yes'].includes(value)) {
    return true;
  }

  if ([false, 0, '0', 'false', 'off', 'no'].includes(value)) {
    return false;
  }

  throw new ValidationError(`${field} must be a boolean.`, [
    { field, message: `${field} must be true or false.` }
  ]);
}

function normalizeYear(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const year = Number(value);
  const maximumYear = new Date().getFullYear() + 5;

  if (!Number.isInteger(year) || year < 1000 || year > maximumYear) {
    throw new ValidationError('Year is invalid.', [
      { field: 'year', message: `Year must be between 1000 and ${maximumYear}.` }
    ]);
  }

  return year;
}

function normalizeDisplayOrder(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const displayOrder = Number(value);

  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 1000000) {
    throw new ValidationError('Display order is invalid.', [
      {
        field: 'displayOrder',
        message: 'Display order must be a whole number between 0 and 1000000.'
      }
    ]);
  }

  return displayOrder;
}

function normalizeSlug(value, title) {
  const rawValue = value || title;
  let normalized;

  if (typeof validators.normalizeSlug === 'function') {
    normalized = validators.normalizeSlug(rawValue);
  } else {
    normalized = String(rawValue || '')
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  normalized = String(normalized || '').trim().toLowerCase();

  if (!normalized || normalized.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new ValidationError('Slug is invalid.', [
      {
        field: 'slug',
        message: 'Slug must contain only lowercase letters, numbers, and single hyphens.'
      }
    ]);
  }

  return normalized;
}

function canonicalizeProvided(source, fieldMap) {
  const result = {};

  for (const [canonicalName, aliases] of Object.entries(fieldMap)) {
    const inputAliases = [
      canonicalName,
      ...aliases,
      canonicalName.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    ];

    for (const alias of inputAliases) {
      if (Object.prototype.hasOwnProperty.call(source, alias)) {
        result[canonicalName] = source[alias];
        break;
      }
    }
  }

  return result;
}

function normalizeProfilePayload(payload, existing = {}) {
  const supplied = canonicalizeProvided(payload || {}, PROFILE_FIELDS);
  const source = { ...existing, ...supplied };

  return {
    name: normalizeString(source.name, 'name', { required: true, maxLength: 120 }),
    headline: normalizeString(source.headline, 'headline', { maxLength: 255 }),
    introduction: normalizeString(source.introduction, 'introduction', { maxLength: 3000 }),
    biography: normalizeString(source.biography, 'biography', { maxLength: 20000 }),
    practiceStatement: normalizeString(source.practiceStatement, 'practiceStatement', {
      maxLength: 10000
    }),
    location: normalizeString(source.location, 'location', { maxLength: 160 }),
    email: normalizeEmail(source.email),
    instagramUrl: normalizeUrl(source.instagramUrl, 'instagramUrl'),
    websiteUrl: normalizeUrl(source.websiteUrl, 'websiteUrl'),
    heroImageUrl: normalizeUrl(source.heroImageUrl, 'heroImageUrl')
  };
}

function normalizeArtworkPayload(payload, existing = {}) {
  const supplied = canonicalizeProvided(payload || {}, ARTWORK_FIELDS);
  const source = { ...existing, ...supplied };
  const title = normalizeString(source.title, 'title', {
    required: true,
    maxLength: 255
  });

  return {
    title,
    slug: normalizeSlug(source.slug, title),
    description: normalizeString(source.description, 'description', { maxLength: 20000 }),
    imageUrl: normalizeUrl(source.imageUrl, 'imageUrl'),
    imageAlt: normalizeString(source.imageAlt, 'imageAlt', { maxLength: 500 }),
    category: normalizeString(source.category, 'category', {
      required: true,
      maxLength: 120
    }),
    year: normalizeYear(source.year),
    medium: normalizeString(source.medium, 'medium', { maxLength: 255 }),
    dimensions: normalizeString(source.dimensions, 'dimensions', { maxLength: 255 }),
    displayOrder: normalizeDisplayOrder(source.displayOrder),
    isPublished: normalizeBoolean(source.isPublished, 'isPublished', false),
    isFeatured: normalizeBoolean(source.isFeatured, 'isFeatured', false)
  };
}

async function runSharedValidation(type, payload) {
  const candidates =
    type === 'profile'
      ? ['validateArtistProfilePayload', 'validateProfilePayload', 'validateArtistProfile']
      : ['validateArtworkPayload', 'validateArtwork'];

  const validatorName = candidates.find((name) => typeof validators[name] === 'function');

  if (!validatorName) {
    return;
  }

  const result = await validators[validatorName](payload);

  if (result === false) {
    throw new ValidationError('The submitted data is invalid.');
  }

  if (Array.isArray(result) && result.length > 0) {
    throw new ValidationError('The submitted data is invalid.', result);
  }

  if (result && typeof result === 'object') {
    const errors = Array.isArray(result.errors)
      ? result.errors
      : Array.isArray(result.validationErrors)
        ? result.validationErrors
        : [];

    if (result.valid === false || result.isValid === false || errors.length > 0) {
      throw new ValidationError('The submitted data is invalid.', errors);
    }
  }
}

function sendValidationError(res, error) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: error.message || 'The submitted data is invalid.',
      details: Array.isArray(error.details) ? error.details : []
    }
  });
}

function sendNotFound(res, resource) {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `${resource} was not found.`
    }
  });
}

function sendSlugConflict(res) {
  return res.status(409).json({
    error: {
      code: 'SLUG_CONFLICT',
      message: 'An artwork with this slug already exists.',
      details: [{ field: 'slug', message: 'Choose a unique slug.' }]
    }
  });
}

function handleControllerError(error, res, next) {
  if (error instanceof ValidationError || error.statusCode === 400 || error.status === 400) {
    return sendValidationError(res, error);
  }

  if (error && error.code === 'ER_DUP_ENTRY') {
    return sendSlugConflict(res);
  }

  return next(error);
}

function adminRequestedDrafts(req) {
  const authenticated = Number.isInteger(Number(req.session?.user?.id)) &&
    Number(req.session.user.id) > 0;
  const requested = ['true', '1', 'yes'].includes(
    String(req.query?.includeDrafts || '').toLowerCase()
  );

  return authenticated && requested;
}

async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM `artist_profile` ORDER BY `id` ASC LIMIT 1'
    );

    if (rows.length === 0) {
      return sendNotFound(res, 'Artist profile');
    }

    return res.status(200).json({
      profile: serializeProfile(rows[0])
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

async function updateProfile(req, res, next) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM `artist_profile` ORDER BY `id` ASC LIMIT 1'
    );

    if (rows.length === 0) {
      return sendNotFound(res, 'Artist profile');
    }

    const currentRow = rows[0];
    const normalized = normalizeProfilePayload(req.body || {}, serializeProfile(currentRow));

    await runSharedValidation('profile', normalized);

    const availableColumns = new Set(Object.keys(currentRow));
    const assignments = [];
    const values = [];

    for (const [canonicalName, candidates] of Object.entries(PROFILE_FIELDS)) {
      const column = resolveColumn(availableColumns, candidates);

      if (column) {
        assignments.push(`${quoteIdentifier(column)} = ?`);
        values.push(normalized[canonicalName]);
      }
    }

    if (availableColumns.has('updated_at')) {
      assignments.push('`updated_at` = CURRENT_TIMESTAMP');
    }

    if (assignments.length === 0) {
      throw new Error('No editable artist profile columns are available.');
    }

    values.push(currentRow.id);

    await pool.execute(
      `UPDATE \`artist_profile\` SET ${assignments.join(', ')} WHERE \`id\` = ? LIMIT 1`,
      values
    );

    const [updatedRows] = await pool.execute(
      'SELECT * FROM `artist_profile` WHERE `id` = ? LIMIT 1',
      [currentRow.id]
    );

    if (updatedRows.length === 0) {
      return sendNotFound(res, 'Artist profile');
    }

    return res.status(200).json({
      profile: serializeProfile(updatedRows[0])
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

async function listArtworks(req, res, next) {
  try {
    const columns = await getArtworkColumns();
    const publishedColumn = resolveColumn(columns, ARTWORK_FIELDS.isPublished, true);
    const displayOrderColumn = resolveColumn(columns, ARTWORK_FIELDS.displayOrder, true);
    const includeDrafts = adminRequestedDrafts(req);

    const whereClause = includeDrafts
      ? ''
      : ` WHERE ${quoteIdentifier(publishedColumn)} = ?`;
    const parameters = includeDrafts ? [] : [1];

    const [rows] = await pool.execute(
      `SELECT * FROM \`artworks\`${whereClause}
       ORDER BY ${quoteIdentifier(displayOrderColumn)} ASC, \`id\` ASC`,
      parameters
    );

    return res.status(200).json({
      artworks: rows.map(serializeArtwork)
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

async function getArtworkBySlug(req, res, next) {
  try {
    const slug = normalizeSlug(req.params?.slug, '');
    const columns = await getArtworkColumns();
    const slugColumn = resolveColumn(columns, ARTWORK_FIELDS.slug, true);
    const publishedColumn = resolveColumn(columns, ARTWORK_FIELDS.isPublished, true);
    const includeDrafts = adminRequestedDrafts(req);

    let query = `SELECT * FROM \`artworks\` WHERE ${quoteIdentifier(slugColumn)} = ?`;
    const parameters = [slug];

    if (!includeDrafts) {
      query += ` AND ${quoteIdentifier(publishedColumn)} = ?`;
      parameters.push(1);
    }

    query += ' LIMIT 1';

    const [rows] = await pool.execute(query, parameters);

    if (rows.length === 0) {
      return sendNotFound(res, 'Artwork');
    }

    return res.status(200).json({
      artwork: serializeArtwork(rows[0])
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

async function createArtwork(req, res, next) {
  let connection;

  try {
    const columns = await getArtworkColumns();
    const normalized = normalizeArtworkPayload(req.body || {});

    await runSharedValidation('artwork', normalized);

    const slugColumn = resolveColumn(columns, ARTWORK_FIELDS.slug, true);
    const displayOrderColumn = resolveColumn(columns, ARTWORK_FIELDS.displayOrder, true);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [duplicates] = await connection.execute(
      `SELECT \`id\` FROM \`artworks\` WHERE ${quoteIdentifier(slugColumn)} = ? LIMIT 1`,
      [normalized.slug]
    );

    if (duplicates.length > 0) {
      await connection.rollback();
      connection.release();
      connection = null;
      return sendSlugConflict(res);
    }

    if (normalized.displayOrder === null) {
      const [orderRows] = await connection.execute(
        `SELECT COALESCE(MAX(${quoteIdentifier(displayOrderColumn)}), -1) + 1 AS next_order
         FROM \`artworks\``
      );
      normalized.displayOrder = Number(orderRows[0].next_order);
    }

    const insertColumns = [];
    const placeholders = [];
    const values = [];

    for (const [canonicalName, candidates] of Object.entries(ARTWORK_FIELDS)) {
      const column = resolveColumn(columns, candidates);

      if (!column) {
        continue;
      }

      insertColumns.push(quoteIdentifier(column));
      placeholders.push('?');

      if (canonicalName === 'isPublished' || canonicalName === 'isFeatured') {
        values.push(normalized[canonicalName] ? 1 : 0);
      } else {
        values.push(normalized[canonicalName]);
      }
    }

    if (insertColumns.length === 0) {
      throw new Error('No artwork columns are available for insertion.');
    }

    const [result] = await connection.execute(
      `INSERT INTO \`artworks\` (${insertColumns.join(', ')})
       VALUES (${placeholders.join(', ')})`,
      values
    );

    const [createdRows] = await connection.execute(
      'SELECT * FROM `artworks` WHERE `id` = ? LIMIT 1',
      [result.insertId]
    );

    await connection.commit();
    connection.release();
    connection = null;

    if (createdRows.length === 0) {
      return sendNotFound(res, 'Artwork');
    }

    return res.status(201).json({
      artwork: serializeArtwork(createdRows[0])
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original failure.
      }
      connection.release();
    }

    return handleControllerError(error, res, next);
  }
}

async function updateArtwork(req, res, next) {
  let connection;

  try {
    const artworkId = Number(req.params?.id);

    if (!Number.isInteger(artworkId) || artworkId <= 0) {
      throw new ValidationError('Artwork id is invalid.', [
        { field: 'id', message: 'Artwork id must be a positive integer.' }
      ]);
    }

    const columns = await getArtworkColumns();
    const slugColumn = resolveColumn(columns, ARTWORK_FIELDS.slug, true);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      'SELECT * FROM `artworks` WHERE `id` = ? LIMIT 1 FOR UPDATE',
      [artworkId]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      connection.release();
      connection = null;
      return sendNotFound(res, 'Artwork');
    }

    const existing = serializeArtwork(existingRows[0]);
    const normalized = normalizeArtworkPayload(req.body || {}, existing);

    if (normalized.displayOrder === null) {
      normalized.displayOrder = existing.displayOrder;
    }

    await runSharedValidation('artwork', normalized);

    const [duplicates] = await connection.execute(
      `SELECT \`id\` FROM \`artworks\`
       WHERE ${quoteIdentifier(slugColumn)} = ? AND \`id\` <> ? LIMIT 1`,
      [normalized.slug, artworkId]
    );

    if (duplicates.length > 0) {
      await connection.rollback();
      connection.release();
      connection = null;
      return sendSlugConflict(res);
    }

    const assignments = [];
    const values = [];

    for (const [canonicalName, candidates] of Object.entries(ARTWORK_FIELDS)) {
      const column = resolveColumn(columns, candidates);

      if (!column) {
        continue;
      }

      assignments.push(`${quoteIdentifier(column)} = ?`);

      if (canonicalName === 'isPublished' || canonicalName === 'isFeatured') {
        values.push(normalized[canonicalName] ? 1 : 0);
      } else {
        values.push(normalized[canonicalName]);
      }
    }

    if (columns.has('updated_at')) {
      assignments.push('`updated_at` = CURRENT_TIMESTAMP');
    }

    if (assignments.length === 0) {
      throw new Error('No editable artwork columns are available.');
    }

    values.push(artworkId);

    await connection.execute(
      `UPDATE \`artworks\` SET ${assignments.join(', ')} WHERE \`id\` = ? LIMIT 1`,
      values
    );

    const [updatedRows] = await connection.execute(
      'SELECT * FROM `artworks` WHERE `id` = ? LIMIT 1',
      [artworkId]
    );

    await connection.commit();
    connection.release();
    connection = null;

    if (updatedRows.length === 0) {
      return sendNotFound(res, 'Artwork');
    }

    return res.status(200).json({
      artwork: serializeArtwork(updatedRows[0])
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original failure.
      }
      connection.release();
    }

    return handleControllerError(error, res, next);
  }
}

async function deleteArtwork(req, res, next) {
  let connection;

  try {
    const artworkId = Number(req.params?.id);

    if (!Number.isInteger(artworkId) || artworkId <= 0) {
      throw new ValidationError('Artwork id is invalid.', [
        { field: 'id', message: 'Artwork id must be a positive integer.' }
      ]);
    }

    const columns = await getArtworkColumns();
    const displayOrderColumn = resolveColumn(columns, ARTWORK_FIELDS.displayOrder, true);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT \`id\`, ${quoteIdentifier(displayOrderColumn)} AS display_order
       FROM \`artworks\` WHERE \`id\` = ? LIMIT 1 FOR UPDATE`,
      [artworkId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      connection = null;
      return sendNotFound(res, 'Artwork');
    }

    await connection.execute('DELETE FROM `artworks` WHERE `id` = ? LIMIT 1', [artworkId]);

    await connection.execute(
      `UPDATE \`artworks\`
       SET ${quoteIdentifier(displayOrderColumn)} = ${quoteIdentifier(displayOrderColumn)} - 1
       WHERE ${quoteIdentifier(displayOrderColumn)} > ?`,
      [rows[0].display_order]
    );

    await connection.commit();
    connection.release();
    connection = null;

    return res.status(200).json({
      message: 'Artwork deleted successfully.',
      deletedId: artworkId
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original failure.
      }
      connection.release();
    }

    return handleControllerError(error, res, next);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  listArtworks,
  getArtworkBySlug,
  createArtwork,
  updateArtwork,
  deleteArtwork
};