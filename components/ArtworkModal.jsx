'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function getArtworkIdentity(artwork) {
  if (!artwork) return null;
  return artwork.id ?? artwork.slug ?? artwork.title ?? null;
}

function findArtworkIndex(artworks, selectedArtwork) {
  if (!selectedArtwork || !Array.isArray(artworks)) return -1;

  const directIndex = artworks.indexOf(selectedArtwork);
  if (directIndex >= 0) return directIndex;

  const selectedIdentity = getArtworkIdentity(selectedArtwork);
  if (selectedIdentity === null) return -1;

  return artworks.findIndex(
    (item) => String(getArtworkIdentity(item)) === String(selectedIdentity),
  );
}

export default function ArtworkModal({
  artwork,
  artworks = [],
  onClose,
  onNavigate,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const closeActionRef = useRef(onClose);
  const navigationActionRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  const isOpen = Boolean(artwork);
  const artworkList = Array.isArray(artworks)
    ? artworks.filter(Boolean)
    : [];
  const currentIndex = findArtworkIndex(artworkList, artwork);
  const hasKnownCollectionPosition = currentIndex >= 0;

  const previousAvailable =
    typeof hasPrevious === 'boolean'
      ? hasPrevious
      : hasKnownCollectionPosition
        ? currentIndex > 0
        : typeof onPrevious === 'function';

  const nextAvailable =
    typeof hasNext === 'boolean'
      ? hasNext
      : hasKnownCollectionPosition
        ? currentIndex < artworkList.length - 1
        : typeof onNext === 'function';

  const imageUrl =
    artwork?.imageUrl || artwork?.image_url || artwork?.image || '';
  const title = artwork?.title?.trim() || 'Untitled';
  const year =
    artwork?.year !== null &&
    artwork?.year !== undefined &&
    artwork?.year !== ''
      ? String(artwork.year)
      : '';
  const medium = artwork?.medium?.trim() || '';
  const dimensions = artwork?.dimensions?.trim() || '';
  const description = artwork?.description?.trim() || '';
  const imageAlt =
    artwork?.altText?.trim() ||
    artwork?.alt_text?.trim() ||
    `${title}${year ? `, ${year}` : ''}`;

  closeActionRef.current = onClose;

  function closeModal() {
    if (typeof closeActionRef.current === 'function') {
      closeActionRef.current();
    }
  }

  function navigate(direction) {
    const movingBackward = direction === 'previous';
    const isAvailable = movingBackward
      ? previousAvailable
      : nextAvailable;

    if (!isAvailable) return;

    const targetIndex =
      currentIndex >= 0
        ? currentIndex + (movingBackward ? -1 : 1)
        : -1;
    const targetArtwork =
      targetIndex >= 0 && targetIndex < artworkList.length
        ? artworkList[targetIndex]
        : null;
    const directionHandler = movingBackward ? onPrevious : onNext;

    if (typeof directionHandler === 'function') {
      directionHandler(targetArtwork, targetIndex);
      return;
    }

    if (targetArtwork && typeof onNavigate === 'function') {
      onNavigate(targetArtwork, targetIndex);
    }
  }

  navigationActionRef.current = {
    previousAvailable,
    nextAvailable,
    previous: () => navigate('previous'),
    next: () => navigate('next'),
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const body = document.body;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      const currentPadding =
        Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }

    const focusTimer = window.requestAnimationFrame(() => {
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      } else {
        dialogRef.current?.focus();
      }
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeActionRef.current?.();
        return;
      }

      if (
        event.key === 'ArrowLeft' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        const navigation = navigationActionRef.current;
        if (navigation?.previousAvailable) {
          event.preventDefault();
          navigation.previous();
        }
        return;
      }

      if (
        event.key === 'ArrowRight' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        const navigation = navigationActionRef.current;
        if (navigation?.nextAvailable) {
          event.preventDefault();
          navigation.next();
        }
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          element instanceof HTMLElement &&
          element.getAttribute('aria-hidden') !== 'true' &&
          element.offsetParent !== null,
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === firstElement ||
          !dialogRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastElement
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isMounted || !isOpen) return null;

  const hasMetadata = Boolean(year || medium || dimensions);
  const positionLabel =
    currentIndex >= 0 && artworkList.length > 1
      ? `Artwork ${currentIndex + 1} of ${artworkList.length}`
      : '';

  return createPortal(
    <div
      className="artwork-modal-overlay modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <section
        ref={dialogRef}
        className="artwork-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="artwork-modal__close modal-close"
          type="button"
          aria-label={`Close details for ${title}`}
          onClick={closeModal}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="artwork-modal__visual modal-image-panel">
          {imageUrl && !imageFailed ? (
            <img
              className="artwork-modal__image modal-image"
              src={imageUrl}
              alt={imageAlt}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div
              className="artwork-modal__image-fallback modal-image-fallback"
              role="img"
              aria-label={`Image unavailable for ${title}`}
            >
              <span aria-hidden="true">
                {title.charAt(0).toUpperCase()}
              </span>
              <p>Image unavailable</p>
            </div>
          )}
        </div>

        <div className="artwork-modal__details modal-details">
          {positionLabel ? (
            <p
              className="artwork-modal__position"
              aria-live="polite"
              aria-atomic="true"
            >
              {positionLabel}
            </p>
          ) : null}

          <h2 id={titleId} className="artwork-modal__title">
            {title}
          </h2>

          {hasMetadata ? (
            <dl className="artwork-modal__metadata modal-metadata">
              {year ? (
                <div className="artwork-modal__metadata-item">
                  <dt>Year</dt>
                  <dd>{year}</dd>
                </div>
              ) : null}

              {medium ? (
                <div className="artwork-modal__metadata-item">
                  <dt>Medium</dt>
                  <dd>{medium}</dd>
                </div>
              ) : null}

              {dimensions ? (
                <div className="artwork-modal__metadata-item">
                  <dt>Dimensions</dt>
                  <dd>{dimensions}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {description ? (
            <div
              id={descriptionId}
              className="artwork-modal__description"
            >
              {description
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={`${paragraph.slice(0, 32)}-${index}`}>
                    {paragraph}
                  </p>
                ))}
            </div>
          ) : null}

          {(previousAvailable || nextAvailable) ? (
            <nav
              className="artwork-modal__navigation modal-navigation"
              aria-label="Artwork navigation"
            >
              <button
                type="button"
                className="artwork-modal__nav-button artwork-modal__nav-button--previous"
                onClick={() => navigate('previous')}
                disabled={!previousAvailable}
                aria-label="View previous artwork"
              >
                <span aria-hidden="true">←</span>
                <span>Previous</span>
              </button>

              <button
                type="button"
                className="artwork-modal__nav-button artwork-modal__nav-button--next"
                onClick={() => navigate('next')}
                disabled={!nextAvailable}
                aria-label="View next artwork"
              >
                <span>Next</span>
                <span aria-hidden="true">→</span>
              </button>
            </nav>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}