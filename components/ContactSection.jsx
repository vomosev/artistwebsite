const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const INSTAGRAM_USERNAME_PATTERN = /^@?([a-zA-Z0-9._]{1,30})$/;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getValidEmail(value) {
  const email = cleanText(value);

  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return "";
  }

  return email;
}

function getValidUrl(value) {
  const candidate = cleanText(value);

  if (!candidate) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function getInstagramUrl(value) {
  const candidate = cleanText(value);

  if (!candidate) {
    return null;
  }

  const usernameMatch = candidate.match(INSTAGRAM_USERNAME_PATTERN);

  if (usernameMatch) {
    return new URL(`https://www.instagram.com/${usernameMatch[1]}/`);
  }

  const url = getValidUrl(candidate);

  if (!url) {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  return hostname === "instagram.com" ? url : null;
}

function formatWebsiteLabel(url, customLabel) {
  const label = cleanText(customLabel);

  if (label) {
    return label;
  }

  return url.hostname.replace(/^www\./, "");
}

export default function ContactSection({ profile = {} }) {
  const artistName =
    cleanText(profile.artist_name) ||
    cleanText(profile.name) ||
    "The artist";

  const heading =
    cleanText(profile.contact_heading) ||
    cleanText(profile.contact_title) ||
    "Let’s start a conversation.";

  const message =
    cleanText(profile.contact_statement) ||
    cleanText(profile.contact_message) ||
    cleanText(profile.contact_text) ||
    "For commissions, exhibitions, collaborations, and other enquiries, please get in touch.";

  const email = getValidEmail(
    profile.email || profile.contact_email || profile.public_email
  );

  const instagramUrl = getInstagramUrl(
    profile.instagram_url || profile.instagram
  );

  const websiteUrl = getValidUrl(
    profile.website_url || profile.website || profile.external_website_url
  );

  const websiteLabel = websiteUrl
    ? formatWebsiteLabel(websiteUrl, profile.website_label)
    : "";

  const year = new Date().getFullYear();

  return (
    <section
      id="contact"
      className="contact-section"
      aria-labelledby="contact-heading"
    >
      <div className="section-shell contact-section__inner">
        <div className="contact-section__eyebrow" aria-hidden="true">
          Contact
        </div>

        <div className="contact-section__content">
          <div className="contact-section__copy">
            <h2 id="contact-heading" className="contact-section__title">
              {heading}
            </h2>
            <p className="contact-section__message">{message}</p>
          </div>

          <div className="contact-section__actions">
            {email ? (
              <a
                className="contact-section__email"
                href={`mailto:${email}`}
                aria-label={`Email ${artistName} at ${email}`}
              >
                <span>{email}</span>
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <p className="contact-section__unavailable" role="status">
                Contact details are currently unavailable.
              </p>
            )}

            {(instagramUrl || websiteUrl) && (
              <ul
                className="contact-section__social-links"
                aria-label="External links"
              >
                {instagramUrl && (
                  <li>
                    <a
                      href={instagramUrl.toString()}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${artistName} on Instagram (opens in a new tab)`}
                    >
                      Instagram
                      <span aria-hidden="true">↗</span>
                    </a>
                  </li>
                )}

                {websiteUrl && (
                  <li>
                    <a
                      href={websiteUrl.toString()}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${websiteLabel} (opens in a new tab)`}
                    >
                      {websiteLabel}
                      <span aria-hidden="true">↗</span>
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        <footer className="site-footer">
          <p className="site-footer__copyright">
            © {year} {artistName}. All rights reserved.
          </p>

          <nav className="site-footer__navigation" aria-label="Footer navigation">
            <a href="#top">Top</a>
            <a href="#work">Work</a>
            <a href="#about">About</a>
            <a href="#contact" aria-current="location">
              Contact
            </a>
          </nav>
        </footer>
      </div>
    </section>
  );
}