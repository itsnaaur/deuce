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
    icons: [
      {
        src: "/icons/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
