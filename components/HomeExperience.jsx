'use client';

import { useEffect, useState } from 'react';
import SiteHeader from './SiteHeader';
import Hero from './Hero';
import PortfolioGrid from './PortfolioGrid';
import AboutSection from './AboutSection';
import ContactSection from './ContactSection';
import * as apiClient from '../lib/api';

const FALLBACK_ARTWORKS = [
  {
    id: -1,
    slug: 'after-the-rain',
    title: 'After the Rain',
    description:
      'A layered study of reflected light and softened architecture, exploring how familiar places shift after a passing storm.',
    year: 2025,
    medium: 'Oil and cold wax on linen',
    dimensions: '48 × 60 in',
    category: 'Painting',
    imageUrl:
      'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=1600&q=85',
    altText: 'Abstract painting with layered blue, ochre, and cream forms',
    displayOrder: 1,
    isPublished: true,
    isFeatured: true,
  },
  {
    id: -2,
    slug: 'field-notes-no-7',
    title: 'Field Notes No. 7',
    description:
      'Gestural marks and translucent washes gather like fragments of a remembered landscape.',
    year: 2024,
    medium: 'Acrylic, graphite, and pigment on canvas',
    dimensions: '40 × 40 in',
    category: 'Mixed Media',
    imageUrl:
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1400&q=85',
    altText: 'Expressive abstract artwork with warm red and muted neutral tones',
    displayOrder: 2,
    isPublished: true,
    isFeatured: false,
  },
  {
    id: -3,
    slug: 'quiet-current',
    title: 'Quiet Current',
    description:
      'An intimate composition shaped by slow observation, repetition, and the movement of water.',
    year: 2024,
    medium: 'Oil on panel',
    dimensions: '30 × 36 in',
    category: 'Painting',
    imageUrl:
      'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1400&q=85',
    altText: 'Abstract composition with flowing green and blue shapes',
    displayOrder: 3,
    isPublished: true,
    isFeatured: false,
  },
  {
    id: -4,
    slug: 'held-light',
    title: 'Held Light',
    description:
      'A luminous arrangement of color and texture considering the emotional weight of ordinary light.',
    year: 2023,
    medium: 'Oil and beeswax on canvas',
    dimensions: '36 × 48 in',
    category: 'Painting',
    imageUrl:
      'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1400&q=85',
    altText: 'Colorful abstract painting with geometric and organic shapes',
    displayOrder: 4,
    isPublished: true,
    isFeatured: false,
  },
  {
    id: -5,
    slug: 'intervals',
    title: 'Intervals',
    description:
      'A sequence of drawn and painted forms that examines rhythm, pause, and visual conversation.',
    year: 2023,
    medium: 'Ink, gouache, and graphite on paper',
    dimensions: '22 × 30 in',
    category: 'Works on Paper',
    imageUrl:
      'https://images.unsplash.com/photo-1578301978018-3005759f48f7?auto=format&fit=crop&w=1400&q=85',
    altText: 'Framed contemporary work displayed against a gallery wall',
    displayOrder: 5,
    isPublished: true,
    isFeatured: false,
  },
  {
    id: -6,
    slug: 'the-distance-between',
    title: 'The Distance Between',
    description:
      'Overlapping fields and erased edges evoke the uncertain boundaries between place, memory, and imagination.',
    year: 2022,
    medium: 'Mixed media on linen',
    dimensions: '54 × 72 in',
    category: 'Mixed Media',
    imageUrl:
      'https://images.unsplash.com/photo-1561839561-b13bcfe95249?auto=format&fit=crop&w=1600&q=85',
    altText: 'Large contemporary abstract painting in soft atmospheric colors',
    displayOrder: 6,
    isPublished: true,
    isFeatured: false,
  },
];

const FALLBACK_PROFILE = {
  id: -1,
  artistName: 'Elena Marlowe',
  name: 'Elena Marlowe',
  headline: 'Studies in color, memory, and place.',
  introduction:
    'Elena Marlowe creates atmospheric paintings and works on paper that consider how landscapes are remembered, altered, and carried with us.',
  biography:
    'Working between observation and abstraction, Elena builds each piece through successive layers of paint, drawing, and erasure. Her work is guided by the textures of lived environments and the subtle ways that light, weather, and time reshape a place.',
  practiceStatement:
    'The studio practice begins with collected impressions—quick drawings, color notes, photographs, and remembered sensations. These fragments are gradually translated into compositions that leave space for ambiguity and personal association.',
  location: 'Portland, Oregon',
  email: 'studio@example.com',
  contactEmail: 'studio@example.com',
  instagramUrl: null,
  websiteUrl: 'https://artistwebsite.geo-drops.com',
  heroImageUrl: FALLBACK_ARTWORKS[0].imageUrl,
};

function resolveApiMethod(names) {
  const containers = [apiClient, apiClient.api, apiClient.default].filter(
    (container) => container && (typeof container === 'object' || typeof container === 'function'),
  );

  for (const container of containers) {
    for (const name of names) {
      if (typeof container[name] === 'function') {
        return container[name].bind(container);
      }
    }
  }

  return null;
}

function requestProfile() {
  const method = resolveApiMethod(['getProfile', 'fetchProfile', 'profile']);

  if (!method) {
    return Promise.reject(new Error('The profile API method is unavailable.'));
  }

  return Promise.resolve().then(() => method());
}

function requestArtworks() {
  const method = resolveApiMethod([
    'listArtworks',
    'getArtworks',
    'fetchArtworks',
    'artworks',
  ]);

  if (!method) {
    return Promise.reject(new Error('The artwork API method is unavailable.'));
  }

  return Promise.resolve().then(() => method());
}

function extractProfile(response) {
  const payload =
    response && typeof response === 'object' && 'data' in response
      ? response.data
      : response;
  const profile =
    payload && typeof payload === 'object' && 'profile' in payload
      ? payload.profile
      : payload;

  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('The profile API returned an invalid response.');
  }

  return profile;
}

function extractArtworks(response) {
  const payload =
    response && typeof response === 'object' && 'data' in response
      ? response.data
      : response;

  const artworks = Array.isArray(payload)
    ? payload
    : payload && Array.isArray(payload.artworks)
      ? payload.artworks
      : payload && Array.isArray(payload.items)
        ? payload.items
        : null;

  if (!artworks) {
    throw new Error('The artwork API returned an invalid response.');
  }

  return artworks.filter((artwork) => {
    if (!artwork || typeof artwork !== 'object') {
      return false;
    }

    const publicationValue =
      artwork.isPublished !== undefined
        ? artwork.isPublished
        : artwork.published;

    return !(
      publicationValue === false ||
      publicationValue === 0 ||
      publicationValue === '0' ||
      publicationValue === 'false'
    );
  });
}

export default function HomeExperience() {
  const [content, setContent] = useState({
    profile: FALLBACK_PROFILE,
    artworks: FALLBACK_ARTWORKS,
    unavailable: [],
  });

  useEffect(() => {
    let isActive = true;

    Promise.allSettled([requestProfile(), requestArtworks()]).then(
      ([profileResult, artworksResult]) => {
        if (!isActive) {
          return;
        }

        const unavailable = [];
        let profile = FALLBACK_PROFILE;
        let artworks = FALLBACK_ARTWORKS;

        if (profileResult.status === 'fulfilled') {
          try {
            profile = extractProfile(profileResult.value);
          } catch {
            unavailable.push('profile');
          }
        } else {
          unavailable.push('profile');
        }

        if (artworksResult.status === 'fulfilled') {
          try {
            artworks = extractArtworks(artworksResult.value);
          } catch {
            unavailable.push('artworks');
          }
        } else {
          unavailable.push('artworks');
        }

        setContent({ profile, artworks, unavailable });
      },
    );

    return () => {
      isActive = false;
    };
  }, []);

  const featuredArtwork =
    content.artworks.find(
      (artwork) =>
        artwork.isFeatured === true ||
        artwork.isFeatured === 1 ||
        artwork.isFeatured === '1',
    ) ||
    content.artworks[0] ||
    null;

  const hasUnavailableContent = content.unavailable.length > 0;
  const artistName =
    content.profile.artistName || content.profile.name || 'Artist Portfolio';

  return (
    <div className="home-experience">
      <SiteHeader profile={content.profile} artistName={artistName} />

      {hasUnavailableContent ? (
        <div className="availability-notice" role="status" aria-live="polite">
          <p>
            Some live portfolio information is temporarily unavailable. Curated
            content is being shown in its place.
          </p>
        </div>
      ) : null}

      <main id="main-content">
        <Hero
          profile={content.profile}
          featuredArtwork={featuredArtwork}
        />
        <PortfolioGrid artworks={content.artworks} />
        <AboutSection profile={content.profile} />
        <ContactSection profile={content.profile} />
      </main>
    </div>
  );
}