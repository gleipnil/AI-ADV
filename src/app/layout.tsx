import type { Metadata } from "next";
import { VT323, DotGothic16 } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
});

const dotGothic16 = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic16",
});

export const metadata: Metadata = {
  title: "AI Adventure Game",
  description: "A retro-style AI adventure game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${vt323.variable} ${dotGothic16.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
