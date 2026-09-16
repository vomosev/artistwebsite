const API_BASE_URL = 'https://artistwebsite-api.geo-drops.com:5094';
const DEFAULT_TIMEOUT_MS = 15000;

export { API_BASE_URL };

export class ApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      code = 'API_ERROR',
      details = null,
      cause = null,
    } = {},
  ) {
    super(message || 'An unexpected API error occurred.');

    this.name = 'ApiError';
    this.status = Number.isFinite(status) ? status : 0;
    this.code = code || 'API_ERROR';
    this.details = details ?? null;
    this.cause = cause ?? null;
    this.isApiError = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      details: this.details,
    };
  }
}

export function isApiError(error) {
  return error instanceof ApiError || error?.isApiError === true;
}

function validatePath(path) {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//')
  ) {
    throw new ApiError('A valid API path is required.', {
      status: 400,
      code: 'INVALID_API_PATH',
    });
  }

  return path;
}

function normalizeTimeout(timeout) {
  const parsed = Number(timeout);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(parsed, 120000);
}

function isRawRequestBody(value) {
  return (
    (typeof FormData !== 'undefined' && value instanceof FormData) ||
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) ||
    (typeof URLSearchParams !== 'undefined' &&
      value instanceof URLSearchParams) ||
    (typeof ReadableStream !== 'undefined' &&
      value instanceof ReadableStream) ||
    typeof value === 'string'
  );
}

function prepareRequestBody(body, headers) {
  if (body === undefined) {
    return undefined;
  }

  if (isRawRequestBody(body)) {
    return body;
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    return JSON.stringify(body);
  } catch (error) {
    throw new ApiError('The request data could not be serialized.', {
      status: 400,
      code: 'INVALID_REQUEST_BODY',
      cause: error,
    });
  }
}

async function parseResponse(response) {
  let text;

  try {
    text = await response.text();
  } catch (error) {
    throw new ApiError('The API response could not be read.', {
      status: response.status,
      code: 'RESPONSE_READ_FAILED',
      cause: error,
    });
  }

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (!response.ok) {
      return null;
    }

    throw new ApiError('The API returned an invalid JSON response.', {
      status: response.status,
      code: 'INVALID_API_RESPONSE',
      cause: error,
    });
  }
}

function errorFromResponse(response, payload) {
  const nestedError =
    payload?.error &&
    typeof payload.error === 'object' &&
    !Array.isArray(payload.error)
      ? payload.error
      : null;

  const message =
    (typeof payload?.message === 'string' && payload.message.trim()) ||
    (typeof payload?.error === 'string' && payload.error.trim()) ||
    (typeof nestedError?.message === 'string' &&
      nestedError.message.trim()) ||
    `The API request failed with status ${response.status}.`;

  const code =
    (typeof payload?.code === 'string' && payload.code) ||
    (typeof nestedError?.code === 'string' && nestedError.code) ||
    `HTTP_${response.status}`;

  const details =
    payload?.details ??
    payload?.errors ??
    nestedError?.details ??
    nestedError?.errors ??
    null;

  return new ApiError(message, {
    status: response.status,
    code,
    details,
  });
}

export async function request(
  path,
  {
    method = 'GET',
    body,
    headers: suppliedHeaders,
    timeout = DEFAULT_TIMEOUT_MS,
    signal,
  } = {},
) {
  const safePath = validatePath(path);
  const controller = new AbortController();
  const headers = new Headers(suppliedHeaders || {});
  const timeoutMs = normalizeTimeout(timeout);
  let timedOut = false;
  let abortListener = null;

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const requestBody = prepareRequestBody(body, headers);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      abortListener = () => controller.abort(signal.reason);
      signal.addEventListener('abort', abortListener, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${safePath}`, {
      method: String(method).toUpperCase(),
      headers,
      body: requestBody,
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      throw errorFromResponse(response, payload);
    }

    return payload;
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }

    if (timedOut) {
      throw new ApiError('The API request timed out. Please try again.', {
        status: 0,
        code: 'REQUEST_TIMEOUT',
        details: { timeoutMs },
        cause: error,
      });
    }

    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new ApiError('The API request was cancelled.', {
        status: 0,
        code: 'REQUEST_ABORTED',
        cause: error,
      });
    }

    throw new ApiError(
      'The portfolio service is currently unavailable. Please try again later.',
      {
        status: 0,
        code: 'API_UNAVAILABLE',
        cause: error,
      },
    );
  } finally {
    clearTimeout(timeoutId);

    if (signal && abortListener) {
      signal.removeEventListener('abort', abortListener);
    }
  }
}

function requireIdentifier(value, label) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim().length === 0
  ) {
    throw new ApiError(`${label} is required.`, {
      status: 400,
      code: 'INVALID_IDENTIFIER',
    });
  }

  return encodeURIComponent(String(value).trim());
}

export function health() {
  return request('/health', { timeout: 5000 });
}

export function getProfile() {
  return request('/api/profile');
}

export function updateProfile(profile) {
  return request('/api/profile', {
    method: 'PUT',
    body: profile,
  });
}

export function listArtworks(options = {}) {
  const normalizedOptions =
    typeof options === 'boolean' ? { includeDrafts: options } : options || {};
  const query = new URLSearchParams();

  if (normalizedOptions.includeDrafts === true) {
    query.set('includeDrafts', 'true');
  }

  if (
    typeof normalizedOptions.category === 'string' &&
    normalizedOptions.category.trim()
  ) {
    query.set('category', normalizedOptions.category.trim());
  }

  if (typeof normalizedOptions.featured === 'boolean') {
    query.set('featured', String(normalizedOptions.featured));
  }

  const queryString = query.toString();

  return request(`/api/artworks${queryString ? `?${queryString}` : ''}`);
}

export function getArtworkBySlug(slug) {
  return request(`/api/artworks/${requireIdentifier(slug, 'Artwork slug')}`);
}

export function createArtwork(artwork) {
  return request('/api/artworks', {
    method: 'POST',
    body: artwork,
  });
}

export function updateArtwork(identifier, artwork) {
  return request(
    `/api/artworks/${requireIdentifier(identifier, 'Artwork identifier')}`,
    {
      method: 'PUT',
      body: artwork,
    },
  );
}

export function deleteArtwork(identifier) {
  return request(
    `/api/artworks/${requireIdentifier(identifier, 'Artwork identifier')}`,
    {
      method: 'DELETE',
    },
  );
}

export function signup(credentials) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: credentials,
  });
}

export function login(credentials) {
  return request('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export function logout() {
  return request('/api/auth/logout', {
    method: 'POST',
  });
}

export function getCurrentSession() {
  return request('/api/auth/me');
}

export const checkHealth = health;
export const getArtworks = listArtworks;
export const getArtwork = getArtworkBySlug;
export const getCurrentUser = getCurrentSession;
export const getMe = getCurrentSession;

const authApi = Object.freeze({
  signup,
  login,
  logout,
  me: getCurrentSession,
  getCurrentSession,
});

const profileApi = Object.freeze({
  get: getProfile,
  update: updateProfile,
});

const artworksApi = Object.freeze({
  list: listArtworks,
  get: getArtworkBySlug,
  create: createArtwork,
  update: updateArtwork,
  delete: deleteArtwork,
});

export const api = Object.freeze({
  request,
  health,
  checkHealth,
  getProfile,
  updateProfile,
  listArtworks,
  getArtworks,
  getArtworkBySlug,
  getArtwork,
  createArtwork,
  updateArtwork,
  deleteArtwork,
  signup,
  login,
  logout,
  getCurrentSession,
  getCurrentUser,
  getMe,
  auth: authApi,
  profile: profileApi,
  artworks: artworksApi,
});

export const apiClient = api;

export default api;