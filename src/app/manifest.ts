import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deuce — Badminton sessions",
    short_name: "Deuce",
    description: "Offline-first badminton roster, queue, and court control.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fafbff",
    theme_color: "#050b14",
    categories: ["sports", "utilities"],
    // Generated from the Deuce mark by `npm run icons`.
    icons: [
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", type: "image/png", sizes: "192x192", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
