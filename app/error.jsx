'use client';

export default function Error({ reset }) {
  return (
    <main className="auth-page">
      <section
        className="auth-shell"
        aria-labelledby="error-title"
        aria-describedby="error-description"
      >
        <div className="auth-card" role="alert">
          <p className="eyebrow">Something went wrong</p>
          <h1 id="error-title">This page could not be displayed.</h1>
          <p id="error-description">
            An unexpected problem interrupted your visit. Please try again or
            return to the portfolio homepage.
          </p>

          <div className="form-actions">
            <button className="button button-primary" type="button" onClick={reset}>
              Try again
            </button>
            <a className="button button-secondary" href="/">
              Return home
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}