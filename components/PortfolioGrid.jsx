'use client';

import { useEffect, useMemo, useState } from 'react';
import ArtworkModal from './ArtworkModal';

const ALL_ARTWORKS = '__all__';

function getArtworkKey(artwork, index = 0) {
  return String(
    artwork?.id ??
      artwork?.slug ??
      `${artwork?.title || 'artwork'}-${artwork?.year || 'undated'}-${index}`
  );
}

function getImageUrl(artwork) {
  return artwork?.imageUrl || artwork?.image_url || artwork?.image || '';
}

function getAltText(artwork) {
  return (
    artwork?.altText ||
    artwork?.alt_text ||
    `${artwork?.title || 'Untitled'}, ${artwork?.year || 'undated'}`
  );
}

function getCategory(artwork) {
  const category = String(artwork?.category || '').trim();
  return category || 'Other';
}

function ArtworkCard({ artwork, index, onSelect }) {
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const title = String(artwork?.title || 'Untitled');
  const imageUrl = getImageUrl(artwork);
  const year = artwork?.year ? String(artwork.year) : '';
  const medium = String(artwork?.medium || '').trim();
  const dimensions = String(artwork?.dimensions || '').trim();

  useEffect(() => {
    setImageUnavailable(false);
  }, [imageUrl]);

  return (
    <article className="artwork-card">
      <button
        type="button"
        className="artwork-card__trigger"
        onClick={() => onSelect(artwork)}
        aria-label={`View details for ${title}${year ? `, ${year}` : ''}`}
        aria-haspopup="dialog"
      >
        <span className="artwork-card__media">
          {imageUrl && !imageUnavailable ? (
            <img
              className="artwork-card__image"
              src={imageUrl}
              alt={getAltText(artwork)}
              loading="lazy"
              decoding="async"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              onError={() => setImageUnavailable(true)}
            />
          ) : (
            <span className="artwork-card__image-fallback" aria-hidden="true">
              <span>{String(index + 1).padStart(2, '0')}</span>
            </span>
          )}
        </span>

        <span className="artwork-card__content">
          <span className="artwork-card__heading">
            <span className="artwork-card__title">{title}</span>
            {year ? <span className="artwork-card__year">{year}</span> : null}
          </span>

          {medium || dimensions ? (
            <span className="artwork-card__metadata">
              {medium ? <span>{medium}</span> : null}
              {medium && dimensions ? <span aria-hidden="true"> · </span> : null}
              {dimensions ? <span>{dimensions}</span> : null}
            </span>
          ) : null}

          <span className="artwork-card__category">{getCategory(artwork)}</span>
        </span>
      </button>
    </article>
  );
}

export default function PortfolioGrid({ artworks = [] }) {
  const safeArtworks = useMemo(
    () => (Array.isArray(artworks) ? artworks.filter(Boolean) : []),
    [artworks]
  );
  const [selectedCategory, setSelectedCategory] = useState(ALL_ARTWORKS);
  const [selectedArtwork, setSelectedArtwork] = useState(null);

  const categories = useMemo(() => {
    const categoryMap = new Map();

    safeArtworks.forEach((artwork) => {
      const label = getCategory(artwork);
      const key = label.toLocaleLowerCase();

      if (!categoryMap.has(key)) {
        categoryMap.set(key, label);
      }
    });

    return Array.from(categoryMap, ([key, label]) => ({ key, label }));
  }, [safeArtworks]);

  useEffect(() => {
    if (
      selectedCategory !== ALL_ARTWORKS &&
      !categories.some((category) => category.key === selectedCategory)
    ) {
      setSelectedCategory(ALL_ARTWORKS);
    }
  }, [categories, selectedCategory]);

  const filteredArtworks = useMemo(() => {
    if (selectedCategory === ALL_ARTWORKS) {
      return safeArtworks;
    }

    return safeArtworks.filter(
      (artwork) => getCategory(artwork).toLocaleLowerCase() === selectedCategory
    );
  }, [safeArtworks, selectedCategory]);

  useEffect(() => {
    if (!selectedArtwork) {
      return;
    }

    const selectedKey = getArtworkKey(selectedArtwork);
    const currentArtwork = filteredArtworks.find(
      (artwork, index) => getArtworkKey(artwork, index) === selectedKey
    );

    if (!currentArtwork) {
      setSelectedArtwork(null);
    } else if (currentArtwork !== selectedArtwork) {
      setSelectedArtwork(currentArtwork);
    }
  }, [filteredArtworks, selectedArtwork]);

  const selectedIndex = selectedArtwork
    ? filteredArtworks.findIndex(
        (artwork, index) =>
          getArtworkKey(artwork, index) === getArtworkKey(selectedArtwork)
      )
    : -1;

  const hasPrevious = selectedIndex > 0;
  const hasNext =
    selectedIndex >= 0 && selectedIndex < filteredArtworks.length - 1;

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedArtwork(null);
  };

  const handlePrevious = () => {
    if (hasPrevious) {
      setSelectedArtwork(filteredArtworks[selectedIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setSelectedArtwork(filteredArtworks[selectedIndex + 1]);
    }
  };

  const handleNavigate = (target) => {
    if (typeof target === 'number') {
      const artwork = filteredArtworks[target];

      if (artwork) {
        setSelectedArtwork(artwork);
      }

      return;
    }

    if (target && typeof target === 'object') {
      setSelectedArtwork(target);
    }
  };

  const resultLabel = `${filteredArtworks.length} ${
    filteredArtworks.length === 1 ? 'artwork' : 'artworks'
  } shown`;

  return (
    <section className="portfolio-section" id="work" aria-labelledby="work-title">
      <div className="portfolio-section__header">
        <div>
          <p className="section-eyebrow">Selected work</p>
          <h2 className="section-title" id="work-title">
            Portfolio
          </h2>
        </div>

        {categories.length > 1 ? (
          <div
            className="portfolio-filters"
            role="group"
            aria-label="Filter artworks by category"
          >
            <button
              type="button"
              className={`portfolio-filter${
                selectedCategory === ALL_ARTWORKS
                  ? ' portfolio-filter--active'
                  : ''
              }`}
              aria-pressed={selectedCategory === ALL_ARTWORKS}
              aria-controls="portfolio-artwork-grid"
              onClick={() => handleCategoryChange(ALL_ARTWORKS)}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                type="button"
                className={`portfolio-filter${
                  selectedCategory === category.key
                    ? ' portfolio-filter--active'
                    : ''
                }`}
                key={category.key}
                aria-pressed={selectedCategory === category.key}
                aria-controls="portfolio-artwork-grid"
                onClick={() => handleCategoryChange(category.key)}
              >
                {category.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {resultLabel}
      </p>

      {filteredArtworks.length > 0 ? (
        <div className="portfolio-grid" id="portfolio-artwork-grid">
          {filteredArtworks.map((artwork, index) => (
            <ArtworkCard
              artwork={artwork}
              index={index}
              key={getArtworkKey(artwork, index)}
              onSelect={setSelectedArtwork}
            />
          ))}
        </div>
      ) : (
        <div
          className="portfolio-empty"
          id="portfolio-artwork-grid"
          role="status"
        >
          <p className="portfolio-empty__eyebrow">Gallery update</p>
          <h3>
            {safeArtworks.length
              ? 'No work in this category yet.'
              : 'New work is being prepared.'}
          </h3>
          <p>
            {safeArtworks.length
              ? 'Choose another category to continue exploring the portfolio.'
              : 'Please return soon to view the latest additions to the collection.'}
          </p>
          {safeArtworks.length ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => handleCategoryChange(ALL_ARTWORKS)}
            >
              View all work
            </button>
          ) : null}
        </div>
      )}

      {selectedArtwork ? (
        <ArtworkModal
          artwork={selectedArtwork}
          artworks={filteredArtworks}
          currentIndex={selectedIndex}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          previousArtwork={
            hasPrevious ? filteredArtworks[selectedIndex - 1] : null
          }
          nextArtwork={hasNext ? filteredArtworks[selectedIndex + 1] : null}
          onClose={() => setSelectedArtwork(null)}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onNavigate={handleNavigate}
        />
      ) : null}
    </section>
  );
}