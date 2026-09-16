'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as apiClient from '../lib/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_FIELDS = new Set(['name', 'email', 'password']);

function resolveAuthMethod(action) {
  const clients = [apiClient.api, apiClient.default, apiClient];

  for (const client of clients) {
    if (
      client &&
      (typeof client === 'object' || typeof client === 'function') &&
      typeof client[action] === 'function'
    ) {
      return client[action].bind(client);
    }
  }

  return null;
}

function validateForm(values, isSignup) {
  const errors = {};
  const name = values.name.trim();
  const email = values.email.trim();

  if (isSignup) {
    if (!name) {
      errors.name = 'Please enter your name.';
    } else if (name.length < 2) {
      errors.name = 'Name must contain at least 2 characters.';
    } else if (name.length > 100) {
      errors.name = 'Name must contain no more than 100 characters.';
    }
  }

  if (!email) {
    errors.email = 'Please enter your email address.';
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Please enter your password.';
  } else if (isSignup && values.password.length < 8) {
    errors.password = 'Password must contain at least 8 characters.';
  } else if (values.password.length > 128) {
    errors.password = 'Password must contain no more than 128 characters.';
  }

  return errors;
}

function normalizeFieldErrors(error) {
  const normalized = {};
  const candidates = [
    error?.fieldErrors,
    error?.errors,
    error?.details?.fields,
    error?.details?.errors,
    error?.data?.fieldErrors,
    error?.data?.errors,
    error?.payload?.fieldErrors,
    error?.payload?.errors,
  ];

  const addError = (field, message) => {
    if (!VALID_FIELDS.has(field) || normalized[field] || !message) {
      return;
    }

    const text = Array.isArray(message) ? message[0] : message;
    if (typeof text === 'string' && text.trim()) {
      normalized[field] = text.trim();
    }
  };

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach((item) => {
        if (item && typeof item === 'object') {
          addError(item.field || item.path || item.param, item.message || item.msg);
        }
      });
      continue;
    }

    if (typeof candidate === 'object') {
      Object.entries(candidate).forEach(([field, message]) => {
        addError(field, message);
      });
    }
  }

  return normalized;
}

function getServerErrorMessage(error, isSignup) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status);

  if (status === 401 && !isSignup) {
    return 'The email address or password is incorrect.';
  }

  if (status === 409 && isSignup) {
    return 'An account with this email address already exists.';
  }

  if (status === 429) {
    return 'Too many attempts were made. Please wait a moment and try again.';
  }

  if (status >= 500) {
    return 'The authentication service is temporarily unavailable. Please try again shortly.';
  }

  const message =
    error?.data?.message ||
    error?.payload?.message ||
    error?.response?.data?.message ||
    error?.message;

  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  return 'We could not complete your request. Please check your connection and try again.';
}

export default function AuthForm({ mode = 'login' }) {
  const router = useRouter();
  const formId = useId();
  const isSignup = mode === 'signup';

  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const fieldRefs = {
    name: nameRef,
    email: emailRef,
    password: passwordRef,
  };

  const updateField = (event) => {
    const { name, value } = event.target;

    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    }

    if (serverError) {
      setServerError('');
    }

    if (statusMessage) {
      setStatusMessage('');
    }
  };

  const focusFirstInvalidField = (errors) => {
    const fieldOrder = isSignup
      ? ['name', 'email', 'password']
      : ['email', 'password'];
    const firstInvalidField = fieldOrder.find((field) => errors[field]);

    if (firstInvalidField) {
      fieldRefs[firstInvalidField].current?.focus();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setServerError('');
    setStatusMessage('');

    const validationErrors = validateForm(values, isSignup);
    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      focusFirstInvalidField(validationErrors);
      return;
    }

    const authMethod = resolveAuthMethod(isSignup ? 'signup' : 'login');

    if (!authMethod) {
      setServerError('The authentication service is not available.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      email: values.email.trim().toLowerCase(),
      password: values.password,
    };

    if (isSignup) {
      payload.name = values.name.trim();
    }

    try {
      await authMethod(payload);
      setStatusMessage(
        isSignup
          ? 'Your account has been created. Opening the portfolio manager…'
          : 'Signed in successfully. Opening the portfolio manager…',
      );
      router.replace('/admin');
      router.refresh();
    } catch (error) {
      const nextFieldErrors = normalizeFieldErrors(error);

      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
        focusFirstInvalidField(nextFieldErrors);
      }

      setServerError(getServerErrorMessage(error, isSignup));
      setIsSubmitting(false);
    }
  };

  const title = isSignup ? 'Create your account' : 'Welcome back';
  const description = isSignup
    ? 'Create a private account to manage the artist profile and portfolio.'
    : 'Sign in to manage the artist profile and portfolio.';

  return (
    <section className="auth-form-shell" aria-labelledby={`${formId}-title`}>
      <div className="auth-form-heading">
        <p className="eyebrow">{isSignup ? 'Portfolio access' : 'Private studio'}</p>
        <h1 id={`${formId}-title`}>{title}</h1>
        <p>{description}</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError ? (
          <div className="form-alert form-alert-error" role="alert" aria-live="assertive">
            <p>{serverError}</p>
          </div>
        ) : null}

        {Object.keys(fieldErrors).length > 0 ? (
          <div className="sr-only" role="alert">
            Please review the highlighted fields and correct the errors.
          </div>
        ) : null}

        {isSignup ? (
          <div className="form-field">
            <label htmlFor={`${formId}-name`}>Name</label>
            <input
              ref={nameRef}
              id={`${formId}-name`}
              name="name"
              type="text"
              value={values.name}
              onChange={updateField}
              autoComplete="name"
              autoCapitalize="words"
              maxLength={100}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? `${formId}-name-error` : undefined}
              required
            />
            {fieldErrors.name ? (
              <p className="field-error" id={`${formId}-name-error`}>
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="form-field">
          <label htmlFor={`${formId}-email`}>Email address</label>
          <input
            ref={emailRef}
            id={`${formId}-email`}
            name="email"
            type="email"
            value={values.email}
            onChange={updateField}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            inputMode="email"
            maxLength={254}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? `${formId}-email-error` : undefined}
            required
          />
          {fieldErrors.email ? (
            <p className="field-error" id={`${formId}-email-error`}>
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor={`${formId}-password`}>Password</label>
          <input
            ref={passwordRef}
            id={`${formId}-password`}
            name="password"
            type="password"
            value={values.password}
            onChange={updateField}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            minLength={isSignup ? 8 : undefined}
            maxLength={128}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password
                ? `${formId}-password-error`
                : isSignup
                  ? `${formId}-password-help`
                  : undefined
            }
            required
          />
          {isSignup && !fieldErrors.password ? (
            <p className="field-help" id={`${formId}-password-help`}>
              Use at least 8 characters and choose a password unique to this account.
            </p>
          ) : null}
          {fieldErrors.password ? (
            <p className="field-error" id={`${formId}-password-error`}>
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isSignup
              ? 'Creating account…'
              : 'Signing in…'
            : isSignup
              ? 'Create account'
              : 'Sign in'}
        </button>

        <div className="form-status" aria-live="polite" aria-atomic="true">
          {statusMessage ? <p>{statusMessage}</p> : null}
        </div>
      </form>

      <p className="auth-switch">
        {isSignup ? 'Already have an account?' : 'Need an account?'}{' '}
        <Link href={isSignup ? '/login' : '/signup'}>
          {isSignup ? 'Sign in' : 'Create one'}
        </Link>
      </p>
    </section>
  );
}