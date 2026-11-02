import type { MetadataRoute } from "next";

// Colors from the light theme tokens (--background, --primary). Icons: npm run icons.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Task Master",
    short_name: "Task Master",
    description: "Your day, your to-dos and a weekly review in one place.",
    id: "/today",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#1d5bd6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
