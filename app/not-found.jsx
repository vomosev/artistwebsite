export const metadata = {
  title: "Page Not Found",
  description: "The requested page could not be found.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main className="not-found-page status-page" aria-labelledby="not-found-title">
      <section className="not-found-card status-card">
        <p className="eyebrow">Error 404</p>
        <h1 id="not-found-title">This page is not part of the collection.</h1>
        <p>
          The page may have moved or the address may be incorrect. Return to the
          portfolio to continue exploring the artist’s work.
        </p>
        <a
          className="button button--primary"
          href="https://artistwebsite.geo-drops.com"
        >
          Return to the portfolio
        </a>
      </section>
    </main>
  );
}