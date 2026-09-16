'use client';

import { useEffect, useRef, useState } from 'react';

const navigationItems = [
  { href: '#work', label: 'Work' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
];

export default function SiteHeader({ artistName, profile }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const toggleRef = useRef(null);

  const brandName =
    artistName ||
    profile?.name ||
    profile?.artistName ||
    profile?.artist_name ||
    'Artist Portfolio';

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        toggleRef.current?.focus();
      }
    };

    const handlePointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const closeMobileMenu = (event) => {
      if (event.matches) setIsMenuOpen(false);
    };

    mediaQuery.addEventListener?.('change', closeMobileMenu);

    return () => {
      mediaQuery.removeEventListener?.('change', closeMobileMenu);
    };
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="site-header" ref={headerRef}>
      <div className="site-header__inner">
        <a
          className="site-brand"
          href="#top"
          aria-label={`${brandName} — return to the top of the page`}
          onClick={closeMenu}
        >
          <span className="site-brand__name">{brandName}</span>
          <span className="site-brand__descriptor">Selected works</span>
        </a>

        <nav
          className="site-navigation site-navigation--desktop"
          aria-label="Primary navigation"
        >
          <ul className="site-navigation__list">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <a className="site-navigation__link" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <a
            className="site-navigation__login"
            href="https://artistwebsite.geo-drops.com/login"
          >
            Login
          </a>
        </nav>

        <button
          ref={toggleRef}
          className="mobile-nav-toggle"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span className="mobile-nav-toggle__icon" aria-hidden="true">
            <span />
            <span />
          </span>
        </button>
      </div>

      <nav
        id="mobile-navigation"
        className={`mobile-navigation${isMenuOpen ? ' mobile-navigation--open' : ''}`}
        aria-label="Mobile navigation"
        hidden={!isMenuOpen}
      >
        <ul className="mobile-navigation__list">
          {navigationItems.map((item) => (
            <li key={item.href}>
              <a
                className="mobile-navigation__link"
                href={item.href}
                onClick={closeMenu}
              >
                {item.label}
              </a>
            </li>
          ))}
          <li>
            <a
              className="mobile-navigation__link mobile-navigation__link--login"
              href="https://artistwebsite.geo-drops.com/login"
              onClick={closeMenu}
            >
              Login
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}