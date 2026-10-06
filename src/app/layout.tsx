import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "./Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = { title: "Paisa", description: "Personal money tracker" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7f7f8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6 sm:pb-12 sm:pt-8">{children}</main>
      </body>
    </html>
  );
}
