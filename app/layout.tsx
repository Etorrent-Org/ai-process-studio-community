import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "AI Process Studio",
  description: "Cartographier, auditer et améliorer les processus métier avec une IA choisie par l’utilisateur.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
