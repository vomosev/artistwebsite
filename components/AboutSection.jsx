const DEFAULTS = {
  biography:
    "An evolving body of work shaped by observation, material curiosity, and a commitment to thoughtful making.",
  location: "Independent studio practice",
  practice:
    "The practice moves between intuition and careful study, allowing each work to develop through color, texture, form, and process.",
  focus: "Original works, exhibitions, and selected collaborations",
  media: "Contemporary visual art",
};

function asText(value) {
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join(", ");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function firstText(...values) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }

  return "";
}

function getCustomDetails(profile) {
  const details = profile.selectedDetails || profile.selected_details;

  if (!Array.isArray(details)) {
    return [];
  }

  return details
    .map((detail) => {
      if (!detail || typeof detail !== "object") return null;

      const label = firstText(detail.label, detail.title);
      const value = firstText(detail.value, detail.text);

      return label && value ? { label, value } : null;
    })
    .filter(Boolean);
}

export default function AboutSection({ profile = {} }) {
  const artistName = firstText(
    profile.artistName,
    profile.artist_name,
    profile.name,
    "The artist"
  );

  const biography = firstText(
    profile.biography,
    profile.bio,
    profile.about,
    DEFAULTS.biography
  );

  const location = firstText(
    profile.location,
    profile.studioLocation,
    profile.studio_location,
    DEFAULTS.location
  );

  const practiceStatement = firstText(
    profile.practiceStatement,
    profile.practice_statement,
    profile.practice,
    profile.artistStatement,
    profile.artist_statement,
    DEFAULTS.practice
  );

  const focus = firstText(
    profile.focus,
    profile.currentFocus,
    profile.current_focus,
    profile.specialisms,
    DEFAULTS.focus
  );

  const media = firstText(
    profile.media,
    profile.mediums,
    profile.disciplines,
    profile.medium,
    DEFAULTS.media
  );

  const biographyParagraphs = biography
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const customDetails = getCustomDetails(profile);
  const details =
    customDetails.length > 0
      ? customDetails
      : [
          { label: "Based", value: location },
          { label: "Media", value: media },
          { label: "Current focus", value: focus },
        ];

  return (
    <section
      className="about-section"
      id="about"
      aria-labelledby="about-heading"
    >
      <div className="section-shell">
        <header className="section-heading about-heading">
          <p className="section-kicker">About the practice</p>
          <h2 id="about-heading">A considered approach to making</h2>
        </header>

        <div className="about-grid">
          <div className="about-biography">
            <p className="about-artist-name">{artistName}</p>
            <div className="about-copy">
              {biographyParagraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="about-practice">
            <p className="about-label">Practice statement</p>
            <p>{practiceStatement}</p>
          </div>

          <aside className="about-details" aria-label="Selected artist details">
            <p className="about-label">Selected details</p>
            <dl>
              {details.map((detail) => (
                <div className="about-detail" key={`${detail.label}-${detail.value}`}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}