import "./globals.css";

const siteUrl = "https://artistwebsite.geo-drops.com";
const description =
  "Explore a curated portfolio of contemporary artwork, selected projects, the artist’s practice, and contact information.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Artist Portfolio",
    template: "%s | Artist Portfolio",
  },
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Artist Portfolio",
    description,
    url: siteUrl,
    siteName: "Artist Portfolio",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}