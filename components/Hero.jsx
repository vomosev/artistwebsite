function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function safeImageUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  const url = value.trim();

  if (url.startsWith("/")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : "";
  } catch {
    return "";
  }
}

function getInitials(name) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "A";
}

export default function Hero({ profile = {}, featuredArtwork = null }) {
  const artwork = featuredArtwork || {};
  const artistName =
    firstText(profile.artistName, profile.artist_name, profile.name) ||
    "Independent Artist";
  const headline =
    firstText(
      profile.headline,
      profile.heroHeadline,
      profile.hero_headline,
      profile.practiceStatement,
      profile.practice_statement
    ) || "Art shaped by observation, material, and memory.";
  const introduction =
    firstText(
      profile.introduction,
      profile.intro,
      profile.shortBio,
      profile.short_bio,
      profile.biography,
      profile.bio
    ) ||
    "Explore a considered selection of original work developed through an evolving studio practice.";

  const imageUrl = safeImageUrl(
    firstText(
      artwork.imageUrl,
      artwork.image_url,
      artwork.image,
      profile.heroImageUrl,
      profile.hero_image_url
    )
  );
  const artworkTitle =
    firstText(artwork.title, artwork.name) || "Featured artwork";
  const artworkAlt =
    firstText(artwork.altText, artwork.alt_text) ||
    `${artworkTitle} by ${artistName}`;
  const artworkYear = firstText(
    artwork.year != null ? String(artwork.year) : "",
    artwork.createdYear != null ? String(artwork.createdYear) : "",
    artwork.created_year != null ? String(artwork.created_year) : ""
  );
  const artworkMedium = firstText(artwork.medium);
  const location = firstText(profile.location);
  const visualLabel = [artworkMedium, artworkYear].filter(Boolean).join(" · ");

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__inner hero-inner">
        <div className="hero__content hero-content">
          <p className="hero__eyebrow hero-eyebrow">
            {location ? `${artistName} · ${location}` : artistName}
          </p>

          <h1 id="hero-title" className="hero__title hero-title">
            {headline}
          </h1>

          <p className="hero__introduction hero-introduction">
            {introduction}
          </p>

          <div className="hero__actions hero-actions">
            <a className="button button--primary" href="#work">
              View selected work
              <span aria-hidden="true">↘</span>
            </a>
            <a className="button button--secondary" href="#contact">
              Contact the artist
            </a>
          </div>
        </div>

        <div className="hero__visual hero-visual">
          {imageUrl ? (
            <figure className="hero__figure">
              <div className="hero__image-frame">
                <img
                  className="hero__image"
                  src={imageUrl}
                  alt={artworkAlt}
                  width="960"
                  height="1200"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  referrerPolicy="no-referrer"
                />
              </div>
              <figcaption className="hero__caption">
                <span>{artworkTitle}</span>
                {visualLabel ? <span>{visualLabel}</span> : null}
              </figcaption>
            </figure>
          ) : (
            <div
              className="hero__fallback"
              role="img"
              aria-label={`Abstract studio monogram for ${artistName}`}
            >
              <span className="hero__fallback-orbit" aria-hidden="true" />
              <span className="hero__fallback-mark" aria-hidden="true">
                {getInitials(artistName)}
              </span>
              <span className="hero__fallback-label" aria-hidden="true">
                Studio practice
              </span>
            </div>
          )}
        </div>
      </div>

      <a className="hero__scroll-cue" href="#work" aria-label="Continue to selected work">
        <span>Selected work</span>
        <span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}