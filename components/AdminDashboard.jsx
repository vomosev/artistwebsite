"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as apiModule from "../lib/api";

const EMPTY_PROFILE = {
  artistName: "",
  headline: "",
  introduction: "",
  biography: "",
  practiceStatement: "",
  location: "",
  email: "",
  instagramUrl: "",
  websiteUrl: "",
  heroImageUrl: "",
};

const EMPTY_ARTWORK = {
  title: "",
  slug: "",
  year: "",
  medium: "",
  dimensions: "",
  description: "",
  imageUrl: "",
  category: "",
  displayOrder: 0,
  isPublished: true,
  isFeatured: false,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function getApiRoots() {
  return [apiModule.api, apiModule.default, apiModule].filter(
    (root, index, roots) =>
      root && (typeof root === "object" || typeof root === "function") &&
      roots.indexOf(root) === index,
  );
}

async function callApi(methodNames, ...args) {
  for (const root of getApiRoots()) {
    for (const methodName of methodNames) {
      if (typeof root[methodName] === "function") {
        return root[methodName](...args);
      }
    }
  }

  throw new Error("The requested API operation is unavailable.");
}

function getErrorMessage(error, fallback) {
  if (!error) {
    return fallback;
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error.error === "string" && error.error.trim()) {
    return error.error.trim();
  }

  return fallback;
}

function isUnauthorized(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  const code = String(error?.code ?? "").toUpperCase();

  return status === 401 || status === 403 || code === "UNAUTHORIZED";
}

function unwrapData(value) {
  if (value && typeof value === "object" && value.data !== undefined) {
    return value.data;
  }

  return value;
}

function extractUser(value) {
  const data = unwrapData(value);

  if (!data || typeof data !== "object") {
    return null;
  }

  if (data.user && typeof data.user === "object") {
    return data.user;
  }

  if (data.authenticated === false) {
    return null;
  }

  if (data.id && (data.email || data.name)) {
    return data;
  }

  return null;
}

function extractProfile(value) {
  const data = unwrapData(value);

  if (data && typeof data === "object" && data.profile) {
    return data.profile;
  }

  return data && typeof data === "object" ? data : {};
}

function extractArtworks(value) {
  const data = unwrapData(value);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.artworks)) {
    return data.artworks;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

function firstDefined(source, keys, fallback = "") {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) {
      return source[key];
    }
  }

  return fallback;
}

function toBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function normalizeProfile(profile) {
  return {
    artistName: String(
      firstDefined(profile, ["artistName", "artist_name", "name"], ""),
    ),
    headline: String(firstDefined(profile, ["headline"], "")),
    introduction: String(firstDefined(profile, ["introduction", "intro"], "")),
    biography: String(firstDefined(profile, ["biography", "bio"], "")),
    practiceStatement: String(
      firstDefined(profile, ["practiceStatement", "practice_statement"], ""),
    ),
    location: String(firstDefined(profile, ["location"], "")),
    email: String(
      firstDefined(profile, ["email", "contactEmail", "contact_email"], ""),
    ),
    instagramUrl: String(
      firstDefined(profile, ["instagramUrl", "instagram_url", "instagram"], ""),
    ),
    websiteUrl: String(
      firstDefined(profile, ["websiteUrl", "website_url", "website"], ""),
    ),
    heroImageUrl: String(
      firstDefined(profile, ["heroImageUrl", "hero_image_url"], ""),
    ),
  };
}

function normalizeArtwork(artwork) {
  return {
    id: firstDefined(artwork, ["id", "artworkId", "artwork_id"], null),
    title: String(firstDefined(artwork, ["title"], "")),
    slug: String(firstDefined(artwork, ["slug"], "")),
    year: firstDefined(artwork, ["year"], "") ?? "",
    medium: String(firstDefined(artwork, ["medium"], "")),
    dimensions: String(firstDefined(artwork, ["dimensions"], "")),
    description: String(firstDefined(artwork, ["description"], "")),
    imageUrl: String(firstDefined(artwork, ["imageUrl", "image_url"], "")),
    category: String(firstDefined(artwork, ["category"], "")),
    displayOrder: Number(
      firstDefined(artwork, ["displayOrder", "display_order"], 0),
    ),
    isPublished: toBoolean(
      firstDefined(artwork, ["isPublished", "is_published", "published"], false),
    ),
    isFeatured: toBoolean(
      firstDefined(artwork, ["isFeatured", "is_featured", "featured"], false),
    ),
  };
}

function sortArtworks(artworks) {
  return [...artworks].sort((left, right) => {
    const orderDifference =
      Number(left.displayOrder || 0) - Number(right.displayOrder || 0);

    if (orderDifference !== 0) {
      return orderDifference;
    }

    return left.title.localeCompare(right.title);
  });
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function isValidOptionalUrl(value) {
  if (!String(value).trim()) {
    return true;
  }

  try {
    const parsed = new URL(String(value).trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validateProfile(profile) {
  const errors = {};

  if (!profile.artistName.trim()) {
    errors.artistName = "Artist name is required.";
  }

  if (!profile.headline.trim()) {
    errors.headline = "A headline is required.";
  }

  if (profile.email.trim() && !EMAIL_PATTERN.test(profile.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  for (const [field, label] of [
    ["instagramUrl", "Instagram URL"],
    ["websiteUrl", "Website URL"],
    ["heroImageUrl", "Hero image URL"],
  ]) {
    if (!isValidOptionalUrl(profile[field])) {
      errors[field] = `${label} must begin with http:// or https://.`;
    }
  }

  return errors;
}

function validateArtwork(artwork) {
  const errors = {};

  if (!artwork.title.trim()) {
    errors.title = "Title is required.";
  }

  if (!artwork.slug.trim()) {
    errors.slug = "Slug is required.";
  } else if (!SLUG_PATTERN.test(artwork.slug.trim())) {
    errors.slug = "Use lowercase letters, numbers, and single hyphens only.";
  }

  if (!artwork.category.trim()) {
    errors.category = "Category is required.";
  }

  if (String(artwork.year).trim()) {
    const year = Number(artwork.year);
    const maximumYear = new Date().getFullYear() + 2;

    if (!Number.isInteger(year) || year < 1000 || year > maximumYear) {
      errors.year = `Enter a year between 1000 and ${maximumYear}.`;
    }
  }

  const displayOrder = Number(artwork.displayOrder);
  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    errors.displayOrder = "Display order must be a non-negative whole number.";
  }

  if (!isValidOptionalUrl(artwork.imageUrl)) {
    errors.imageUrl = "Image URL must begin with http:// or https://.";
  }

  if (artwork.isFeatured && !artwork.isPublished) {
    errors.isFeatured = "A featured artwork must also be published.";
  }

  return errors;
}

function profilePayload(profile) {
  return {
    artistName: profile.artistName.trim(),
    headline: profile.headline.trim(),
    introduction: profile.introduction.trim(),
    biography: profile.biography.trim(),
    practiceStatement: profile.practiceStatement.trim(),
    location: profile.location.trim(),
    email: profile.email.trim().toLowerCase(),
    instagramUrl: profile.instagramUrl.trim(),
    websiteUrl: profile.websiteUrl.trim(),
    heroImageUrl: profile.heroImageUrl.trim(),
  };
}

function artworkPayload(artwork) {
  return {
    title: artwork.title.trim(),
    slug: artwork.slug.trim().toLowerCase(),
    year: String(artwork.year).trim() ? Number(artwork.year) : null,
    medium: artwork.medium.trim(),
    dimensions: artwork.dimensions.trim(),
    description: artwork.description.trim(),
    imageUrl: artwork.imageUrl.trim(),
    category: artwork.category.trim(),
    displayOrder: Number(artwork.displayOrder),
    isPublished: Boolean(artwork.isPublished),
    isFeatured: Boolean(artwork.isFeatured && artwork.isPublished),
  };
}

function ErrorText({ id, children }) {
  if (!children) {
    return null;
  }

  return (
    <p className="field-error" id={id} role="alert">
      {children}
    </p>
  );
}

function ImagePreview({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`admin-image-placeholder ${className}`.trim()}
        aria-label={src ? "Image preview unavailable" : "No image selected"}
      >
        <span>{src ? "Preview unavailable" : "No image preview"}</span>
      </div>
    );
  }

  return (
    <img
      className={`admin-image-preview ${className}`.trim()}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const editorRef = useRef(null);

  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [artworks, setArtworks] = useState([]);

  const [profileErrors, setProfileErrors] = useState({});
  const [profileStatus, setProfileStatus] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [artworkForm, setArtworkForm] = useState(EMPTY_ARTWORK);
  const [artworkErrors, setArtworkErrors] = useState({});
  const [artworkStatus, setArtworkStatus] = useState("");
  const [artworkSaving, setArtworkSaving] = useState(false);
  const [slugWasEdited, setSlugWasEdited] = useState(false);

  const [actionKey, setActionKey] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const sortedArtworks = useMemo(() => sortArtworks(artworks), [artworks]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          artworks
            .map((artwork) => artwork.category.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [artworks],
  );

  async function fetchAllArtworks() {
    const response = await callApi(
      ["listArtworks", "getArtworks", "fetchArtworks"],
      { includeDrafts: true, includeUnpublished: true, admin: true },
    );

    const nextArtworks = extractArtworks(response).map(normalizeArtwork);
    setArtworks(sortArtworks(nextArtworks));
    return nextArtworks;
  }

  async function loadDashboard() {
    setLoadState("loading");
    setLoadError("");

    try {
      const sessionResponse = await callApi([
        "me",
        "getCurrentSession",
        "getCurrentUser",
        "currentSession",
      ]);
      const sessionUser = extractUser(sessionResponse);

      if (!sessionUser) {
        router.replace("/login");
        return;
      }

      const [profileResponse, artworkResponse] = await Promise.all([
        callApi(["getProfile", "fetchProfile", "profile"]),
        callApi(
          ["listArtworks", "getArtworks", "fetchArtworks"],
          { includeDrafts: true, includeUnpublished: true, admin: true },
        ),
      ]);

      setUser(sessionUser);
      setProfile(normalizeProfile(extractProfile(profileResponse)));
      setArtworks(
        sortArtworks(extractArtworks(artworkResponse).map(normalizeArtwork)),
      );
      setLoadState("ready");
    } catch (error) {
      if (isUnauthorized(error)) {
        router.replace("/login");
        return;
      }

      setLoadError(
        getErrorMessage(
          error,
          "The management API is currently unavailable. Please try again.",
        ),
      );
      setLoadState("error");
    }
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const sessionResponse = await callApi([
          "me",
          "getCurrentSession",
          "getCurrentUser",
          "currentSession",
        ]);

        if (!active) {
          return;
        }

        const sessionUser = extractUser(sessionResponse);
        if (!sessionUser) {
          router.replace("/login");
          return;
        }

        const [profileResponse, artworkResponse] = await Promise.all([
          callApi(["getProfile", "fetchProfile", "profile"]),
          callApi(
            ["listArtworks", "getArtworks", "fetchArtworks"],
            { includeDrafts: true, includeUnpublished: true, admin: true },
          ),
        ]);

        if (!active) {
          return;
        }

        setUser(sessionUser);
        setProfile(normalizeProfile(extractProfile(profileResponse)));
        setArtworks(
          sortArtworks(extractArtworks(artworkResponse).map(normalizeArtwork)),
        );
        setLoadState("ready");
      } catch (error) {
        if (!active) {
          return;
        }

        if (isUnauthorized(error)) {
          router.replace("/login");
          return;
        }

        setLoadError(
          getErrorMessage(
            error,
            "The management API is currently unavailable. Please try again.",
          ),
        );
        setLoadState("error");
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (editorOpen) {
      editorRef.current?.focus();
    }
  }, [editorOpen, editingId]);

  function updateProfileField(event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
    setProfileErrors((current) => ({ ...current, [name]: undefined }));
    setProfileStatus("");
  }

  async function saveProfile(event) {
    event.preventDefault();

    const errors = validateProfile(profile);
    setProfileErrors(errors);
    setProfileStatus("");

    if (Object.keys(errors).length > 0) {
      setProfileStatus("Please correct the highlighted profile fields.");
      return;
    }

    setProfileSaving(true);

    try {
      const response = await callApi(
        ["updateProfile", "saveProfile"],
        profilePayload(profile),
      );
      const returnedProfile = extractProfile(response);

      if (returnedProfile && Object.keys(returnedProfile).length > 0) {
        setProfile(normalizeProfile(returnedProfile));
      }

      setProfileStatus("Profile saved successfully.");
    } catch (error) {
      if (isUnauthorized(error)) {
        router.replace("/login");
        return;
      }

      setProfileStatus(
        getErrorMessage(error, "The profile could not be saved. Try again."),
      );
    } finally {
      setProfileSaving(false);
    }
  }

  function startCreate() {
    const nextOrder =
      sortedArtworks.length === 0
        ? 0
        : Math.max(...sortedArtworks.map((item) => item.displayOrder || 0)) + 1;

    setEditingId(null);
    setArtworkForm({ ...EMPTY_ARTWORK, displayOrder: nextOrder });
    setArtworkErrors({});
    setArtworkStatus("");
    setSlugWasEdited(false);
    setEditorOpen(true);
  }

  function startEdit(artwork) {
    setEditingId(artwork.id);
    setArtworkForm({ ...normalizeArtwork(artwork) });
    setArtworkErrors({});
    setArtworkStatus("");
    setSlugWasEdited(true);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (artworkSaving) {
      return;
    }

    setEditorOpen(false);
    setEditingId(null);
    setArtworkErrors({});
    setArtworkStatus("");
  }

  function updateArtworkField(event) {
    const { name, type, checked, value } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    setArtworkForm((current) => {
      const next = { ...current, [name]: nextValue };

      if (name === "title" && !slugWasEdited) {
        next.slug = slugify(value);
      }

      if (name === "isPublished" && !checked) {
        next.isFeatured = false;
      }

      if (name === "isFeatured" && checked) {
        next.isPublished = true;
      }

      return next;
    });

    if (name === "slug") {
      setSlugWasEdited(true);
    }

    setArtworkErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(name === "isPublished" || name === "isFeatured"
        ? { isFeatured: undefined }
        : {}),
    }));
    setArtworkStatus("");
  }

  async function saveArtwork(event) {
    event.preventDefault();

    const errors = validateArtwork(artworkForm);
    setArtworkErrors(errors);
    setArtworkStatus("");

    if (Object.keys(errors).length > 0) {
      setArtworkStatus("Please correct the highlighted artwork fields.");
      return;
    }

    setArtworkSaving(true);

    try {
      const payload = artworkPayload(artworkForm);

      if (editingId !== null && editingId !== undefined) {
        await callApi(
          ["updateArtwork", "saveArtwork"],
          editingId,
          payload,
        );
      } else {
        await callApi(["createArtwork", "addArtwork"], payload);
      }

      try {
        await fetchAllArtworks();
        setListStatus("");
      } catch {
        setListStatus(
          "The artwork was saved, but the refreshed artwork list is temporarily unavailable.",
        );
      }

      setArtworkStatus(
        editingId !== null && editingId !== undefined
          ? "Artwork saved successfully."
          : "Artwork created successfully.",
      );

      if (editingId === null || editingId === undefined) {
        setEditorOpen(false);
        setArtworkForm(EMPTY_ARTWORK);
      }
    } catch (error) {
      if (isUnauthorized(error)) {
        router.replace("/login");
        return;
      }

      setArtworkStatus(
        getErrorMessage(error, "The artwork could not be saved. Try again."),
      );
    } finally {
      setArtworkSaving(false);
    }
  }

  async function updateArtworkImmediately(artwork, changes, operation) {
    const identifier = artwork.id ?? artwork.slug;
    setActionKey(`${operation}:${identifier}`);
    setListStatus("");

    try {
      const nextArtwork = {
        ...artwork,
        ...changes,
      };

      if (nextArtwork.isFeatured) {
        nextArtwork.isPublished = true;
      }

      if (!nextArtwork.isPublished) {
        nextArtwork.isFeatured = false;
      }

      await callApi(
        ["updateArtwork", "saveArtwork"],
        identifier,
        artworkPayload(nextArtwork),
      );
      await fetchAllArtworks();

      if (operation === "publish") {
        setListStatus(
          nextArtwork.isPublished
            ? `"${artwork.title}" is now published.`
            : `"${artwork.title}" is now a draft.`,
        );
      } else if (operation === "feature") {
        setListStatus(
          nextArtwork.isFeatured
            ? `"${artwork.title}" is now featured.`
            : `"${artwork.title}" is no longer featured.`,
        );
      } else {
        setListStatus("Artwork order updated.");
      }
    } catch (error) {
      if (isUnauthorized(error)) {
        router.replace("/login");
        return;
      }

      setListStatus(
        getErrorMessage(error, "The artwork could not be updated. Try again."),
      );

      try {
        await fetchAllArtworks();
      } catch {
        // Keep the currently rendered list when both update and refresh fail.
      }
    } finally {
      setActionKey("");
    }
  }

  async function moveArtwork(index, direction) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= sortedArtworks.length) {
      return;
    }

    const current = sortedArtworks[index];
    const target = sortedArtworks[targetIndex];
    const currentIdentifier = current.id ?? current.slug;
    const targetIdentifier = target.id ?? target.slug;
    const currentOrder = Number(current.displayOrder);
    const targetOrder = Number(target.displayOrder);
    const operationKey = `order:${currentIdentifier}`;

    setActionKey(operationKey);
    setListStatus("");

    const replacementCurrentOrder =
      currentOrder === targetOrder ? targetIndex : targetOrder;
    const replacementTargetOrder =
      currentOrder === targetOrder ? index : currentOrder;

    try {
      await Promise.all([
        callApi(
          ["updateArtwork", "saveArtwork"],
          currentIdentifier,
          artworkPayload({
            ...current,
            displayOrder: replacementCurrentOrder,
          }),
        ),
        callApi(
          ["updateArtwork", "saveArtwork"],
          targetIdentifier,
          artworkPayload({
            ...target,
            displayOrder: replacementTargetOrder,
          }),
        ),
      ]);

      await fetchAllArtworks();
      setListStatus("Artwork order updated.");
    } catch (error) {
      if (isUnauthorized(error)) {
        router.replace("/login");
        return;
      }

      setListStatus(
        getErrorMessage(error, "The artwork order could not be updated."),
      );

      try {
        await fetchAllArtworks();
      } catch {
        // Preserve the existing list if the API remains unavailable.
      }
    } finally {
      setActionKey("");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    const identifier = deleteTarget.id ?? deleteTarget.slug;
    setActionKey(`delete:${identifier}`);
    setListStatus("");

    try {
      await callApi(["deleteArtwork", "removeArtwork"], identifier);
      setArtworks((current) =>
        current.filter(
          (artwork) => (artwork.id ?? artwork.slug) !== identifier,
        ),
      );

      if (editingId === deleteTarget.id) {
        closeEditor();
      }

      setDeleteTarget(null);
      setListStatus(`"${deleteTarget.title}" was deleted.`);
    } catch (error) {
      if (isUnauthorized(error)) {
        router.replace("/login");
        return;
      }

      setListStatus(
        getErrorMessage(error, "The artwork could not be deleted. Try again."),
      );
    } finally {
      setActionKey("");
    }
  }

  async function logout() {
    setLoggingOut(true);
    setLoadError("");

    try {
      await callApi(["logout", "signOut"]);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLoadError(
        getErrorMessage(error, "Unable to log out. Please try again."),
      );
      setLoggingOut(false);
    }
  }

  if (loadState === "loading") {
    return (
      <main className="admin-state" aria-busy="true">
        <div className="admin-state-card">
          <p className="eyebrow">Studio administration</p>
          <h1>Loading your portfolio</h1>
          <p>Verifying your session and retrieving the latest work.</p>
          <span className="loading-indicator" aria-hidden="true" />
        </div>
      </main>
    );
  }

  if (loadState === "error") {
    return (
      <main className="admin-state">
        <div className="admin-state-card" role="alert">
          <p className="eyebrow">Studio administration</p>
          <h1>Management tools are unavailable</h1>
          <p>{loadError}</p>
          <div className="admin-state-actions">
            <button className="button button-primary" type="button" onClick={loadDashboard}>
              Try again
            </button>
            <a className="button button-secondary" href="/">
              View portfolio
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-dashboard">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Studio administration</p>
          <h1>Portfolio manager</h1>
          <p className="admin-welcome">
            Signed in as{" "}
            <strong>{user?.name || user?.email || "portfolio administrator"}</strong>
          </p>
        </div>

        <nav className="admin-header-actions" aria-label="Management actions">
          <a className="button button-secondary" href="/" target="_blank" rel="noreferrer">
            View live site
          </a>
          <button
            className="button button-quiet"
            type="button"
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </nav>
      </header>

      {loadError ? (
        <p className="admin-notice admin-notice-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="admin-layout">
        <section className="admin-panel" aria-labelledby="profile-heading">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">Public identity</p>
              <h2 id="profile-heading">Artist profile</h2>
            </div>
            <p>Update the introduction, biography, contact links, and hero image.</p>
          </div>

          <form className="admin-form" onSubmit={saveProfile} noValidate>
            <div className="admin-form-grid">
              <div className="form-field">
                <label htmlFor="profile-artist-name">Artist name</label>
                <input
                  id="profile-artist-name"
                  name="artistName"
                  value={profile.artistName}
                  onChange={updateProfileField}
                  autoComplete="name"
                  aria-invalid={Boolean(profileErrors.artistName)}
                  aria-describedby={
                    profileErrors.artistName ? "profile-artist-name-error" : undefined
                  }
                  required
                />
                <ErrorText id="profile-artist-name-error">
                  {profileErrors.artistName}
                </ErrorText>
              </div>

              <div className="form-field">
                <label htmlFor="profile-location">Location</label>
                <input
                  id="profile-location"
                  name="location"
                  value={profile.location}
                  onChange={updateProfileField}
                  autoComplete="address-level2"
                  placeholder="City, country"
                />
              </div>

              <div className="form-field admin-form-span">
                <label htmlFor="profile-headline">Headline</label>
                <input
                  id="profile-headline"
                  name="headline"
                  value={profile.headline}
                  onChange={updateProfileField}
                  aria-invalid={Boolean(profileErrors.headline)}
                  aria-describedby={
                    profileErrors.headline ? "profile-headline-error" : undefined
                  }
                  required
                />
                <ErrorText id="profile-headline-error">
                  {profileErrors.headline}
                </ErrorText>
              </div>

              <div className="form-field admin-form-span">
                <label htmlFor="profile-introduction">Introduction</label>
                <textarea
                  id="profile-introduction"
                  name="introduction"
                  value={profile.introduction}
                  onChange={updateProfileField}
                  rows={3}
                />
              </div>

              <div className="form-field admin-form-span">
                <label htmlFor="profile-biography">Biography</label>
                <textarea
                  id="profile-biography"
                  name="biography"
                  value={profile.biography}
                  onChange={updateProfileField}
                  rows={7}
                />
              </div>

              <div className="form-field admin-form-span">
                <label htmlFor="profile-practice">Practice statement</label>
                <textarea
                  id="profile-practice"
                  name="practiceStatement"
                  value={profile.practiceStatement}
                  onChange={updateProfileField}
                  rows={5}
                />
              </div>

              <div className="form-field">
                <label htmlFor="profile-email">Contact email</label>
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  value={profile.email}
                  onChange={updateProfileField}
                  autoComplete="email"
                  aria-invalid={Boolean(profileErrors.email)}
                  aria-describedby={
                    profileErrors.email ? "profile-email-error" : undefined
                  }
                />
                <ErrorText id="profile-email-error">{profileErrors.email}</ErrorText>
              </div>

              <div className="form-field">
                <label htmlFor="profile-instagram">Instagram URL</label>
                <input
                  id="profile-instagram"
                  name="instagramUrl"
                  type="url"
                  value={profile.instagramUrl}
                  onChange={updateProfileField}
                  placeholder="https://instagram.com/…"
                  aria-invalid={Boolean(profileErrors.instagramUrl)}
                  aria-describedby={
                    profileErrors.instagramUrl
                      ? "profile-instagram-error"
                      : undefined
                  }
                />
                <ErrorText id="profile-instagram-error">
                  {profileErrors.instagramUrl}
                </ErrorText>
              </div>

              <div className="form-field">
                <label htmlFor="profile-website">External website URL</label>
                <input
                  id="profile-website"
                  name="websiteUrl"
                  type="url"
                  value={profile.websiteUrl}
                  onChange={updateProfileField}
                  placeholder="https://example.com"
                  aria-invalid={Boolean(profileErrors.websiteUrl)}
                  aria-describedby={
                    profileErrors.websiteUrl ? "profile-website-error" : undefined
                  }
                />
                <ErrorText id="profile-website-error">
                  {profileErrors.websiteUrl}
                </ErrorText>
              </div>

              <div className="form-field">
                <label htmlFor="profile-hero-image">Hero image URL</label>
                <input
                  id="profile-hero-image"
                  name="heroImageUrl"
                  type="url"
                  value={profile.heroImageUrl}
                  onChange={updateProfileField}
                  placeholder="https://images.example.com/studio.jpg"
                  aria-invalid={Boolean(profileErrors.heroImageUrl)}
                  aria-describedby={
                    profileErrors.heroImageUrl
                      ? "profile-hero-image-error"
                      : "profile-hero-image-help"
                  }
                />
                <p className="field-help" id="profile-hero-image-help">
                  Use a direct HTTPS image URL for the homepage hero.
                </p>
                <ErrorText id="profile-hero-image-error">
                  {profileErrors.heroImageUrl}
                </ErrorText>
              </div>
            </div>

            <ImagePreview
              src={profile.heroImageUrl.trim()}
              alt="Hero image preview"
              className="admin-profile-preview"
            />

            <div className="admin-form-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={profileSaving}
              >
                {profileSaving ? "Saving profile…" : "Save profile"}
              </button>
              <p
                className="form-status"
                role={profileStatus.includes("successfully") ? "status" : "alert"}
                aria-live="polite"
              >
                {profileStatus}
              </p>
            </div>
          </form>
        </section>

        <section className="admin-panel" aria-labelledby="artworks-heading">
          <div className="admin-panel-heading admin-panel-heading-row">
            <div>
              <p className="eyebrow">Collection</p>
              <h2 id="artworks-heading">Artworks</h2>
              <p>
                {artworks.length} {artworks.length === 1 ? "work" : "works"},{" "}
                {artworks.filter((artwork) => artwork.isPublished).length} published
              </p>
            </div>
            <button className="button button-primary" type="button" onClick={startCreate}>
              Add artwork
            </button>
          </div>

          <p className="admin-list-status" role="status" aria-live="polite">
            {listStatus}
          </p>

          {sortedArtworks.length === 0 ? (
            <div className="admin-empty-state">
              <h3>No artworks yet</h3>
              <p>Create the first artwork to begin building the portfolio.</p>
              <button className="button button-secondary" type="button" onClick={startCreate}>
                Create artwork
              </button>
            </div>
          ) : (
            <div className="admin-artwork-list">
              {sortedArtworks.map((artwork, index) => {
                const identifier = artwork.id ?? artwork.slug;
                const rowBusy = actionKey.endsWith(`:${identifier}`);

                return (
                  <article
                    className="admin-artwork-row"
                    key={identifier}
                    aria-busy={rowBusy}
                  >
                    <ImagePreview
                      src={artwork.imageUrl}
                      alt={`${artwork.title} preview`}
                      className="admin-artwork-thumbnail"
                    />

                    <div className="admin-artwork-summary">
                      <div className="admin-artwork-title-line">
                        <h3>{artwork.title}</h3>
                        <span
                          className={
                            artwork.isPublished
                              ? "status-badge status-badge-published"
                              : "status-badge status-badge-draft"
                          }
                        >
                          {artwork.isPublished ? "Published" : "Draft"}
                        </span>
                        {artwork.isFeatured ? (
                          <span className="status-badge status-badge-featured">
                            Featured
                          </span>
                        ) : null}
                      </div>
                      <p>
                        {[artwork.category, artwork.year, artwork.medium]
                          .filter(Boolean)
                          .join(" · ") || "No metadata added"}
                      </p>
                      <p className="admin-artwork-slug">/{artwork.slug}</p>
                    </div>

                    <div className="admin-order-controls" aria-label={`Order ${artwork.title}`}>
                      <span>Order {artwork.displayOrder}</span>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => moveArtwork(index, -1)}
                        disabled={index === 0 || Boolean(actionKey)}
                        aria-label={`Move ${artwork.title} earlier`}
                        title="Move earlier"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => moveArtwork(index, 1)}
                        disabled={
                          index === sortedArtworks.length - 1 || Boolean(actionKey)
                        }
                        aria-label={`Move ${artwork.title} later`}
                        title="Move later"
                      >
                        ↓
                      </button>
                    </div>

                    <div className="admin-artwork-actions">
                      <button
                        className="button button-quiet"
                        type="button"
                        onClick={() =>
                          updateArtworkImmediately(
                            artwork,
                            {
                              isPublished: !artwork.isPublished,
                              isFeatured: artwork.isPublished
                                ? artwork.isFeatured
                                : false,
                            },
                            "publish",
                          )
                        }
                        disabled={Boolean(actionKey)}
                      >
                        {artwork.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        className="button button-quiet"
                        type="button"
                        onClick={() =>
                          updateArtworkImmediately(
                            artwork,
                            {
                              isFeatured: !artwork.isFeatured,
                              isPublished: artwork.isFeatured
                                ? artwork.isPublished
                                : true,
                            },
                            "feature",
                          )
                        }
                        disabled={Boolean(actionKey)}
                      >
                        {artwork.isFeatured ? "Unfeature" : "Feature"}
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => startEdit(artwork)}
                        disabled={Boolean(actionKey)}
                      >
                        Edit
                      </button>
                      <button
                        className="button button-danger"
                        type="button"
                        onClick={() => setDeleteTarget(artwork)}
                        disabled={Boolean(actionKey)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {editorOpen ? (
          <section
            className="admin-panel admin-editor"
            aria-labelledby="artwork-editor-heading"
          >
            <div className="admin-panel-heading admin-panel-heading-row">
              <div>
                <p className="eyebrow">
                  {editingId !== null && editingId !== undefined
                    ? "Edit work"
                    : "New work"}
                </p>
                <h2 id="artwork-editor-heading" tabIndex={-1} ref={editorRef}>
                  {editingId !== null && editingId !== undefined
                    ? `Edit ${artworkForm.title || "artwork"}`
                    : "Create artwork"}
                </h2>
              </div>
              <button
                className="button button-quiet"
                type="button"
                onClick={closeEditor}
                disabled={artworkSaving}
              >
                Close editor
              </button>
            </div>

            <form className="admin-form" onSubmit={saveArtwork} noValidate>
              <div className="admin-editor-layout">
                <div className="admin-form-grid">
                  <div className="form-field">
                    <label htmlFor="artwork-title">Title</label>
                    <input
                      id="artwork-title"
                      name="title"
                      value={artworkForm.title}
                      onChange={updateArtworkField}
                      aria-invalid={Boolean(artworkErrors.title)}
                      aria-describedby={
                        artworkErrors.title ? "artwork-title-error" : undefined
                      }
                      required
                    />
                    <ErrorText id="artwork-title-error">
                      {artworkErrors.title}
                    </ErrorText>
                  </div>

                  <div className="form-field">
                    <label htmlFor="artwork-slug">URL slug</label>
                    <input
                      id="artwork-slug"
                      name="slug"
                      value={artworkForm.slug}
                      onChange={updateArtworkField}
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={Boolean(artworkErrors.slug)}
                      aria-describedby={
                        artworkErrors.slug
                          ? "artwork-slug-error"
                          : "artwork-slug-help"
                      }
                      required
                    />
                    <p className="field-help" id="artwork-slug-help">
                      Lowercase words separated by hyphens.
                    </p>
                    <ErrorText id="artwork-slug-error">
                      {artworkErrors.slug}
                    </ErrorText>
                  </div>

                  <div className="form-field">
                    <label htmlFor="artwork-category">Category</label>
                    <input
                      id="artwork-category"
                      name="category"
                      value={artworkForm.category}
                      onChange={updateArtworkField}
                      list="artwork-categories"
                      aria-invalid={Boolean(artworkErrors.category)}
                      aria-describedby={
                        artworkErrors.category
                          ? "artwork-category-error"
                          : undefined
                      }
                      required
                    />
                    <datalist id="artwork-categories">
                      {categories.map((category) => (
                        <option value={category} key={category} />
                      ))}
                    </datalist>
                    <ErrorText id="artwork-category-error">
                      {artworkErrors.category}
                    </ErrorText>
                  </div>

                  <div className="form-field">
                    <label htmlFor="artwork-year">Year</label>
                    <input
                      id="artwork-year"
                      name="year"
                      type="number"
                      min="1000"
                      max={new Date().getFullYear() + 2}
                      value={artworkForm.year}
                      onChange={updateArtworkField}
                      aria-invalid={Boolean(artworkErrors.year)}
                      aria-describedby={
                        artworkErrors.year ? "artwork-year-error" : undefined
                      }
                    />
                    <ErrorText id="artwork-year-error">
                      {artworkErrors.year}
                    </ErrorText>
                  </div>

                  <div className="form-field">
                    <label htmlFor="artwork-medium">Medium</label>
                    <input
                      id="artwork-medium"
                      name="medium"
                      value={artworkForm.medium}
                      onChange={updateArtworkField}
                      placeholder="Oil on linen"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="artwork-dimensions">Dimensions</label>
                    <input
                      id="artwork-dimensions"
                      name="dimensions"
                      value={artworkForm.dimensions}
                      onChange={updateArtworkField}
                      placeholder="120 × 90 cm"
                    />
                  </div>

                  <div className="form-field admin-form-span">
                    <label htmlFor="artwork-description">Description</label>
                    <textarea
                      id="artwork-description"
                      name="description"
                      value={artworkForm.description}
                      onChange={updateArtworkField}
                      rows={6}
                    />
                  </div>

                  <div className="form-field admin-form-span">
                    <label htmlFor="artwork-image">Image URL</label>
                    <input
                      id="artwork-image"
                      name="imageUrl"
                      type="url"
                      value={artworkForm.imageUrl}
                      onChange={updateArtworkField}
                      placeholder="https://images.example.com/artwork.jpg"
                      aria-invalid={Boolean(artworkErrors.imageUrl)}
                      aria-describedby={
                        artworkErrors.imageUrl
                          ? "artwork-image-error"
                          : "artwork-image-help"
                      }
                    />
                    <p className="field-help" id="artwork-image-help">
                      Use a direct, publicly accessible HTTPS image URL.
                    </p>
                    <ErrorText id="artwork-image-error">
                      {artworkErrors.imageUrl}
                    </ErrorText>
                  </div>

                  <div className="form-field">
                    <label htmlFor="artwork-order">Display order</label>
                    <input
                      id="artwork-order"
                      name="displayOrder"
                      type="number"
                      min="0"
                      step="1"
                      value={artworkForm.displayOrder}
                      onChange={updateArtworkField}
                      aria-invalid={Boolean(artworkErrors.displayOrder)}
                      aria-describedby={
                        artworkErrors.displayOrder
                          ? "artwork-order-error"
                          : undefined
                      }
                    />
                    <ErrorText id="artwork-order-error">
                      {artworkErrors.displayOrder}
                    </ErrorText>
                  </div>

                  <fieldset className="form-field admin-visibility-options">
                    <legend>Visibility</legend>
                    <label className="checkbox-field">
                      <input
                        name="isPublished"
                        type="checkbox"
                        checked={artworkForm.isPublished}
                        onChange={updateArtworkField}
                      />
                      <span>Published on the public portfolio</span>
                    </label>
                    <label className="checkbox-field">
                      <input
                        name="isFeatured"
                        type="checkbox"
                        checked={artworkForm.isFeatured}
                        onChange={updateArtworkField}
                      />
                      <span>Feature this artwork in the hero</span>
                    </label>
                    <ErrorText id="artwork-featured-error">
                      {artworkErrors.isFeatured}
                    </ErrorText>
                  </fieldset>
                </div>

                <aside className="admin-editor-preview" aria-label="Artwork image preview">
                  <ImagePreview
                    src={artworkForm.imageUrl.trim()}
                    alt={
                      artworkForm.title
                        ? `${artworkForm.title} preview`
                        : "Artwork preview"
                    }
                  />
                  <div>
                    <p className="eyebrow">{artworkForm.category || "Artwork"}</p>
                    <h3>{artworkForm.title || "Untitled work"}</h3>
                    <p>
                      {[artworkForm.year, artworkForm.medium]
                        .filter(Boolean)
                        .join(" · ") || "Add year and medium"}
                    </p>
                  </div>
                </aside>
              </div>

              <div className="admin-form-actions">
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={artworkSaving}
                >
                  {artworkSaving
                    ? "Saving artwork…"
                    : editingId !== null && editingId !== undefined
                      ? "Save artwork"
                      : "Create artwork"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={closeEditor}
                  disabled={artworkSaving}
                >
                  Cancel
                </button>
                <p
                  className="form-status"
                  role={artworkStatus.includes("successfully") ? "status" : "alert"}
                  aria-live="polite"
                >
                  {artworkStatus}
                </p>
              </div>
            </form>
          </section>
        ) : null}
      </div>

      {deleteTarget ? (
        <div
          className="confirmation-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actionKey) {
              setDeleteTarget(null);
            }
          }}
        >
          <div
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-artwork-title"
            aria-describedby="delete-artwork-description"
          >
            <p className="eyebrow">Permanent action</p>
            <h2 id="delete-artwork-title">Delete “{deleteTarget.title}”?</h2>
            <p id="delete-artwork-description">
              This removes the artwork and its portfolio record permanently. This
              action cannot be undone.
            </p>
            <div className="confirmation-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={actionKey.startsWith("delete:")}
                autoFocus
              >
                Keep artwork
              </button>
              <button
                className="button button-danger"
                type="button"
                onClick={confirmDelete}
                disabled={actionKey.startsWith("delete:")}
              >
                {actionKey.startsWith("delete:") ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}