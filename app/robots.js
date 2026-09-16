export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/login', '/signup'],
    },
    sitemap: 'https://artistwebsite.geo-drops.com/sitemap.xml',
    host: 'https://artistwebsite.geo-drops.com',
  };
}