import type { Metadata } from "next";
import { Crimson_Text, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const serif = Crimson_Text({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-serif", display: "swap" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "memopipe", template: "%s · memopipe" },
  description: "Partager, tester et améliorer les automatisations de l'équipe, avec la mémoire Screenpipe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
