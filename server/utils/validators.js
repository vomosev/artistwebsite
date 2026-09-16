'use strict';

class ValidationError extends Error {
  constructor(message = 'The submitted data is invalid.', errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
    this.statusCode = 400;
    this.errors = Array.isArray(errors) ? errors : [];
    Error.captureStackTrace?.(this, ValidationError);
  }
}

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const URL_MAX_LENGTH = 2048;
const SLUG_MAX_LENGTH = 180;
const CURRENT_YEAR = new Date().getUTCFullYear();
const MAX_ARTWORK_YEAR = CURRENT_YEAR + 2;
const MAX_DISPLAY_ORDER = 1000000;

const BLOCKED_RECORD_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'sessionData',
  'session_data',
  'sessionSecret',
  'session_secret'
]);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cleanString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).normalize('NFC').trim();
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);

  if (!email || email.length > EMAIL_MAX_LENGTH || /\s/.test(email)) {
    return false;
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === email.length - 1) {
    return false;
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (
    local.length > 64 ||
    domain.length > 253 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..')
  ) {
    return false;
  }

  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) {
    return false;
  }

  const labels = domain.split('.');
  if (labels.length < 2) {
    return false;
  }

  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

function validateEmail(value, options = {}) {
  const field = options.field || 'email';
  const required = options.required !== false;
  const email = normalizeEmail(value);

  if (!email && !required) {
    return null;
  }

  if (!email) {
    throw fieldError(field, 'Email is required.');
  }

  if (!isValidEmail(email)) {
    throw fieldError(field, 'Enter a valid email address.');
  }

  return email;
}

function validatePassword(value, options = {}) {
  const field = options.field || 'password';
  const strict = options.strict !== false;
  const password = typeof value === 'string' ? value : '';

  if (!password) {
    throw fieldError(field, 'Password is required.');
  }

  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    throw fieldError(
      field,
      `Password must be no more than ${PASSWORD_MAX_BYTES} bytes.`
    );
  }

  if (!strict) {
    return password;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw fieldError(
      field,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw fieldError(
      field,
      'Password must contain at least one letter and one number.'
    );
  }

  return password;
}

function normalizeUrl(value, fieldOrOptions = 'url', maybeOptions = {}) {
  let field = 'url';
  let options = maybeOptions;

  if (isPlainObject(fieldOrOptions)) {
    options = fieldOrOptions;
    field = options.field || 'url';
  } else {
    field = fieldOrOptions || 'url';
  }

  const required = options.required === true;
  const urlValue = cleanString(value);

  if (!urlValue) {
    if (required) {
      throw fieldError(field, `${humanizeField(field)} is required.`);
    }
    return null;
  }

  if (urlValue.length > URL_MAX_LENGTH) {
    throw fieldError(
      field,
      `${humanizeField(field)} must be ${URL_MAX_LENGTH} characters or fewer.`
    );
  }

  let parsed;
  try {
    parsed = new URL(urlValue);
  } catch {
    throw fieldError(field, `Enter a valid ${humanizeField(field).toLowerCase()}.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw fieldError(field, 'Only HTTP and HTTPS URLs are allowed.');
  }

  if (!parsed.hostname || parsed.username || parsed.password) {
    throw fieldError(field, `Enter a valid ${humanizeField(field).toLowerCase()}.`);
  }

  return parsed.toString();
}

function isValidUrl(value, options = {}) {
  try {
    normalizeUrl(value, options);
    return true;
  } catch {
    return false;
  }
}

function normalizeBoolean(value, defaultValue = false, field = 'value') {
  if (value === undefined || value === null || value === '') {
    return Boolean(defaultValue);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 1 || value === '1') {
    return true;
  }

  if (value === 0 || value === '0') {
    return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  throw fieldError(field, `${humanizeField(field)} must be true or false.`);
}

function validateBoolean(value, options = {}) {
  return normalizeBoolean(
    value,
    options.defaultValue === undefined ? false : options.defaultValue,
    options.field || 'value'
  );
}

function normalizeYear(value, options = {}) {
  const field = options.field || 'year';
  const required = options.required !== false;
  const minimum = Number.isInteger(options.minimum) ? options.minimum : 1000;
  const maximum = Number.isInteger(options.maximum)
    ? options.maximum
    : MAX_ARTWORK_YEAR;

  if (value === undefined || value === null || cleanString(value) === '') {
    if (required) {
      throw fieldError(field, 'Year is required.');
    }
    return null;
  }

  const year =
    typeof value === 'number' && Number.isInteger(value)
      ? value
      : Number(cleanString(value));

  if (!Number.isInteger(year) || year < minimum || year > maximum) {
    throw fieldError(
      field,
      `Year must be a whole number between ${minimum} and ${maximum}.`
    );
  }

  return year;
}

function validateYear(value, options = {}) {
  return normalizeYear(value, options);
}

function normalizeDisplayOrder(value, options = {}) {
  const field = options.field || 'displayOrder';
  const defaultValue =
    options.defaultValue === undefined ? 0 : options.defaultValue;

  if (value === undefined || value === null || cleanString(value) === '') {
    return defaultValue;
  }

  const order =
    typeof value === 'number' && Number.isInteger(value)
      ? value
      : Number(cleanString(value));

  if (
    !Number.isInteger(order) ||
    order < 0 ||
    order > MAX_DISPLAY_ORDER
  ) {
    throw fieldError(
      field,
      `Display order must be a whole number between 0 and ${MAX_DISPLAY_ORDER}.`
    );
  }

  return order;
}

function validateDisplayOrder(value, options = {}) {
  return normalizeDisplayOrder(value, options);
}

function normalizeSlug(value) {
  return cleanString(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

function isValidSlug(value) {
  const slug = cleanString(value);
  return (
    slug.length > 0 &&
    slug.length <= SLUG_MAX_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  );
}

function validateSlug(value, options = {}) {
  const field = options.field || 'slug';
  const required = options.required !== false;
  const slug = normalizeSlug(value);

  if (!slug) {
    if (required) {
      throw fieldError(field, 'Slug is required.');
    }
    return null;
  }

  if (!isValidSlug(slug)) {
    throw fieldError(
      field,
      'Slug may contain only lowercase letters, numbers, and single hyphens.'
    );
  }

  return slug;
}

function validateProfilePayload(payload, options = {}) {
  const settings = normalizePayloadOptions(options);
  assertPayloadObject(payload);

  const errors = [];
  const result = {};

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['name', 'artistName', 'artist_name'],
    output: 'name',
    label: 'Artist name',
    required: !settings.partial,
    maxLength: 120
  });

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['headline'],
    output: 'headline',
    label: 'Headline',
    required: false,
    maxLength: 240,
    defaultValue: ''
  });

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['introduction', 'intro'],
    output: 'introduction',
    label: 'Introduction',
    required: false,
    maxLength: 1500,
    defaultValue: ''
  });

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['biography', 'bio'],
    output: 'biography',
    label: 'Biography',
    required: false,
    maxLength: 12000,
    defaultValue: ''
  });

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['practiceStatement', 'practice_statement', 'practice'],
    output: 'practiceStatement',
    label: 'Practice statement',
    required: false,
    maxLength: 6000,
    defaultValue: ''
  });

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['location'],
    output: 'location',
    label: 'Location',
    required: false,
    maxLength: 180,
    defaultValue: ''
  });

  collectCustomField({
    payload,
    result,
    errors,
    aliases: ['email', 'contactEmail', 'contact_email'],
    output: 'email',
    required: !settings.partial,
    defaultValue: null,
    transform: (value) =>
      validateEmail(value, { field: 'email', required: !settings.partial })
  });

  collectCustomField({
    payload,
    result,
    errors,
    aliases: ['instagramUrl', 'instagram_url', 'instagram'],
    output: 'instagramUrl',
    required: false,
    defaultValue: null,
    transform: (value) => normalizeUrl(value, 'instagramUrl')
  });

  collectCustomField({
    payload,
    result,
    errors,
    aliases: ['websiteUrl', 'website_url', 'website'],
    output: 'websiteUrl',
    required: false,
    defaultValue: null,
    transform: (value) => normalizeUrl(value, 'websiteUrl')
  });

  collectCustomField({
    payload,
    result,
    errors,
    aliases: [
      'heroImageUrl',
      'hero_image_url',
      'portraitImageUrl',
      'portrait_image_url'
    ],
    output: 'heroImageUrl',
    required: false,
    defaultValue: null,
    transform: (value) => normalizeUrl(value, 'heroImageUrl')
  });

  if (errors.length) {
    throw new ValidationError('Please correct the profile fields.', errors);
  }

  if (settings.partial && Object.keys(result).length === 0) {
    throw new ValidationError('No profile fields were provided.', [
      { field: 'payload', message: 'Provide at least one profile field.' }
    ]);
  }

  return result;
}

function validateArtworkPayload(payload, options = {}) {
  const settings = normalizePayloadOptions(options);
  assertPayloadObject(payload);

  const errors = [];
  const result = {};

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['title'],
    output: 'title',
    label: 'Title',
    required: !settings.partial,
    maxLength: 180
  });

  const slugInput = readAliasedValue(payload, ['slug']);
  if (slugInput.found) {
    try {
      result.slug = validateSlug(slugInput.value, {
        field: 'slug',
        required: true
      });
    } catch (error) {
      appendValidationErrors(errors, error, 'slug');
    }
  } else if (!settings.partial) {
    const title = result.title || cleanString(readAliasedValue(payload, ['title']).value);
    try {
      result.slug = validateSlug(title, { field: 'slug', required: true });
    } catch (error) {
      appendValidationErrors(errors, error, 'slug');
    }
  }

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['description'],
    output: 'description',
    label: 'Description',
    required: false,
    maxLength: 12000,
    defaultValue: ''
  });

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['category'],
    output: 'category',
    label: 'Category',
    required: !settings.partial,
    maxLength: 100
  });

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['medium'],
    output: 'medium',
    label: 'Medium',
    required: !settings.partial,
    maxLength: 180
  });

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['dimensions'],
    output: 'dimensions',
    label: 'Dimensions',
    required: false,
    maxLength: 140,
    defaultValue: ''
  });

  collectCustomField({
    payload,
    result,
    errors,
    aliases: ['year'],
    output: 'year',
    required: !settings.partial,
    defaultValue: null,
    transform: (value) =>
      normalizeYear(value, { field: 'year', required: true })
  });

  collectCustomField({
    payload,
    result,
    errors,
    aliases: ['imageUrl', 'image_url'],
    output: 'imageUrl',
    required: false,
    defaultValue: null,
    transform: (value) => normalizeUrl(value, 'imageUrl')
  });

  collectStringField({
    payload,
    result,
    errors,
    aliases: ['altText', 'alt_text'],
    output: 'altText',
    label: 'Alternative text',
    required: false,
    maxLength: 320,
    defaultValue: ''
  });

  collectCustomField({
    payload,
    result,
    errors,
    aliases: ['displayOrder', 'display_order'],
    output: 'displayOrder',
    required: false,
    defaultValue: 0,
    transform: (value) =>
      normalizeDisplayOrder(value, {
        field: 'displayOrder',
        defaultValue: 0
      })
  });

  collectCustomField({
    payload,
    result,
    errors,
    aliases: ['isPublished', 'is_published', 'published'],
    output: 'isPublished',
    required: false,
    defaultValue: false,
    transform: (value) => normalizeBoolean(value, false, 'isPublished')
  });

  collectCustomField({
    payload,
    result,
    errors,
    aliases: ['isFeatured', 'is_featured', 'featured'],
    output: 'isFeatured',
    required: false,
    defaultValue: false,
    transform: (value) => normalizeBoolean(value, false, 'isFeatured')
  });

  if (
    !settings.partial &&
    (!hasOwn(result, 'altText') || !result.altText) &&
    result.title
  ) {
    result.altText = result.title;
  }

  if (errors.length) {
    throw new ValidationError('Please correct the artwork fields.', errors);
  }

  if (settings.partial && Object.keys(result).length === 0) {
    throw new ValidationError('No artwork fields were provided.', [
      { field: 'payload', message: 'Provide at least one artwork field.' }
    ]);
  }

  return result;
}

function toProfileResponse(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    id: safeInteger(readRecordValue(record, ['id']), null),
    name: safeString(readRecordValue(record, ['name', 'artist_name']), ''),
    headline: safeString(readRecordValue(record, ['headline']), ''),
    introduction: safeString(
      readRecordValue(record, ['introduction', 'intro']),
      ''
    ),
    biography: safeString(readRecordValue(record, ['biography', 'bio']), ''),
    practiceStatement: safeString(
      readRecordValue(record, [
        'practice_statement',
        'practiceStatement',
        'practice'
      ]),
      ''
    ),
    location: safeString(readRecordValue(record, ['location']), ''),
    email: safeNullableString(
      readRecordValue(record, ['email', 'contact_email', 'contactEmail'])
    ),
    instagramUrl: safeNullableString(
      readRecordValue(record, ['instagram_url', 'instagramUrl', 'instagram'])
    ),
    websiteUrl: safeNullableString(
      readRecordValue(record, ['website_url', 'websiteUrl', 'website'])
    ),
    heroImageUrl: safeNullableString(
      readRecordValue(record, [
        'hero_image_url',
        'heroImageUrl',
        'portrait_image_url',
        'portraitImageUrl'
      ])
    ),
    createdAt: toIsoDate(
      readRecordValue(record, ['created_at', 'createdAt'])
    ),
    updatedAt: toIsoDate(
      readRecordValue(record, ['updated_at', 'updatedAt'])
    )
  };
}

function toArtworkResponse(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    id: safeInteger(readRecordValue(record, ['id']), null),
    title: safeString(readRecordValue(record, ['title']), ''),
    slug: safeString(readRecordValue(record, ['slug']), ''),
    description: safeString(readRecordValue(record, ['description']), ''),
    category: safeString(readRecordValue(record, ['category']), ''),
    medium: safeString(readRecordValue(record, ['medium']), ''),
    dimensions: safeString(readRecordValue(record, ['dimensions']), ''),
    year: safeInteger(readRecordValue(record, ['year']), null),
    imageUrl: safeNullableString(
      readRecordValue(record, ['image_url', 'imageUrl'])
    ),
    altText: safeString(
      readRecordValue(record, ['alt_text', 'altText']),
      ''
    ),
    displayOrder: safeInteger(
      readRecordValue(record, ['display_order', 'displayOrder']),
      0
    ),
    isPublished: safeBoolean(
      readRecordValue(record, ['is_published', 'isPublished', 'published'])
    ),
    isFeatured: safeBoolean(
      readRecordValue(record, ['is_featured', 'isFeatured', 'featured'])
    ),
    createdAt: toIsoDate(
      readRecordValue(record, ['created_at', 'createdAt'])
    ),
    updatedAt: toIsoDate(
      readRecordValue(record, ['updated_at', 'updatedAt'])
    )
  };
}

function mysqlRecordToApi(record) {
  if (record === null || record === undefined) {
    return record;
  }

  if (record instanceof Date) {
    return toIsoDate(record);
  }

  if (typeof record === 'bigint') {
    return record <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(record)
      : record.toString();
  }

  if (Array.isArray(record)) {
    return record.map(mysqlRecordToApi);
  }

  if (typeof record !== 'object') {
    return record;
  }

  const output = {};

  for (const [key, value] of Object.entries(record)) {
    if (BLOCKED_RECORD_KEYS.has(key)) {
      continue;
    }

    output[toCamelCase(key)] = mysqlRecordToApi(value);
  }

  return output;
}

function fieldError(field, message) {
  return new ValidationError(message, [{ field, message }]);
}

function assertPayloadObject(payload) {
  if (!isPlainObject(payload)) {
    throw new ValidationError('A JSON object is required.', [
      { field: 'payload', message: 'Request body must be a JSON object.' }
    ]);
  }
}

function normalizePayloadOptions(options) {
  if (typeof options === 'boolean') {
    return { partial: options };
  }

  return {
    partial: Boolean(options && (options.partial || options.isUpdate))
  };
}

function collectStringField(configuration) {
  const {
    payload,
    result,
    errors,
    aliases,
    output,
    label,
    required,
    maxLength,
    defaultValue
  } = configuration;

  const input = readAliasedValue(payload, aliases);

  if (!input.found) {
    if (required) {
      errors.push({ field: output, message: `${label} is required.` });
    } else if (defaultValue !== undefined && !configuration.partial) {
      result[output] = defaultValue;
    }
    return;
  }

  const value = cleanString(input.value);

  if (!value && required) {
    errors.push({ field: output, message: `${label} is required.` });
    return;
  }

  if (value.length > maxLength) {
    errors.push({
      field: output,
      message: `${label} must be ${maxLength} characters or fewer.`
    });
    return;
  }

  result[output] = value;
}

function collectCustomField(configuration) {
  const {
    payload,
    result,
    errors,
    aliases,
    output,
    required,
    defaultValue,
    transform
  } = configuration;

  const input = readAliasedValue(payload, aliases);

  if (!input.found) {
    if (required) {
      try {
        result[output] = transform(undefined);
      } catch (error) {
        appendValidationErrors(errors, error, output);
      }
    } else if (defaultValue !== undefined) {
      result[output] = defaultValue;
    }
    return;
  }

  try {
    result[output] = transform(input.value);
  } catch (error) {
    appendValidationErrors(errors, error, output);
  }
}

function appendValidationErrors(errors, error, fallbackField) {
  if (error instanceof ValidationError && error.errors.length) {
    errors.push(...error.errors);
    return;
  }

  errors.push({
    field: fallbackField,
    message: error && error.message ? error.message : 'Invalid value.'
  });
}

function readAliasedValue(payload, aliases) {
  for (const alias of aliases) {
    if (hasOwn(payload, alias)) {
      return { found: true, value: payload[alias] };
    }
  }

  return { found: false, value: undefined };
}

function readRecordValue(record, keys) {
  for (const key of keys) {
    if (hasOwn(record, key)) {
      return record[key];
    }
  }

  return undefined;
}

function safeString(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function safeNullableString(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
}

function safeInteger(value, fallback = null) {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : fallback;
  }

  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

function safeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  return value === 1;
}

function toIsoDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toCamelCase(value) {
  return String(value).replace(/_([a-z0-9])/g, (_, character) =>
    character.toUpperCase()
  );
}

function humanizeField(field) {
  const text = String(field)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();

  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Value';
}

module.exports = {
  ValidationError,
  normalizeEmail,
  isValidEmail,
  validateEmail,
  validatePassword,
  normalizeUrl,
  validateUrl: normalizeUrl,
  validateURL: normalizeUrl,
  isValidUrl,
  normalizeBoolean,
  validateBoolean,
  normalizeYear,
  validateYear,
  normalizeDisplayOrder,
  validateDisplayOrder,
  normalizeSlug,
  isValidSlug,
  validateSlug,
  validateProfilePayload,
  validateArtworkPayload,
  toProfileResponse,
  profileRecordToResponse: toProfileResponse,
  normalizeProfileRecord: toProfileResponse,
  toArtworkResponse,
  artworkRecordToResponse: toArtworkResponse,
  normalizeArtworkRecord: toArtworkResponse,
  mysqlRecordToApi,
  normalizeMysqlRecord: mysqlRecordToApi
};