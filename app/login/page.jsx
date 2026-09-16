import Link from "next/link";
import AuthForm from "../../components/AuthForm";

export const metadata = {
  title: "Log in",
  description: "Log in to manage the artist profile and portfolio.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-brand" aria-labelledby="login-heading">
          <Link className="auth-brand-link" href="/" aria-label="Return to portfolio">
            Artist Portfolio
          </Link>

          <div className="auth-brand-copy">
            <p className="eyebrow">Portfolio management</p>
            <h1 id="login-heading">Welcome back.</h1>
            <p>
              Sign in to curate the artist profile, publish new work, and manage
              the portfolio collection.
            </p>
          </div>

          <Link className="auth-back-link" href="/">
            <span aria-hidden="true">←</span> Return to portfolio
          </Link>
        </section>

        <section className="auth-panel" aria-label="Account login">
          <div className="auth-panel-header">
            <p className="eyebrow">Private access</p>
            <h2>Log in</h2>
            <p>Enter your account details to continue to the dashboard.</p>
          </div>

          <AuthForm mode="login" />

          <p className="auth-switch">
            Need an account? <Link href="/signup">Create one</Link>
          </p>
        </section>
      </div>
    </main>
  );
}