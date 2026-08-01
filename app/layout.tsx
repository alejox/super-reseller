import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Only the panel pages use `font-mono` (ids and tier codes). Preloading
  // it on every route made the browser warn that it downloaded a font it
  // never used — on the login page, which is the one route that should be
  // fastest.
  preload: false,
});

export const metadata: Metadata = {
  // `%s` is filled by each route's own title (see app/login/page.tsx).
  title: { default: "Panel de revendedores", template: "%s · Panel de revendedores" },
  description: "Panel de administración y de revendedores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
