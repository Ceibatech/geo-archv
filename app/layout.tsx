import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Archives MULCV",
    template: "%s | Archives MULCV",
  },
  description: "Inventaire CG1020 des dossiers de base et dossiers ACD du MULCV.",
};

export const viewport: Viewport = {
  themeColor: "#071a2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
