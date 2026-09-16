import Link from "next/link";
import AuthForm from "../../components/AuthForm";

export const metadata = {
  title: "Create Account",
  description: "Create an account to manage the artist portfolio.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignupPage() {
  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="signup-title">
        <div className="auth-brand">
          <Link className="auth-home-link" href="/">
            <span aria-hidden="true">←</span> Back to portfolio
          </Link>

          <div className="auth-heading">
            <p className="eyebrow">Portfolio administration</p>
            <h1 id="signup-title">Create your account</h1>
            <p>
              Set up secure access to manage the artist profile and portfolio.
            </p>
          </div>
        </div>

        <div className="auth-card">
          <AuthForm mode="signup" />

          <p className="auth-switch">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}