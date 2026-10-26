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
});

const TAGLINE = "Sponsors for events too small to have a sponsorship team.";
// The approved elevator pitch (16 Oct), used for link previews (Devpost, chat apps).
const PITCH = `${TAGLINE} Pick your music and city, and Echolocate uses Qloo taste data to rank the brands and local shops your crowd likes, then drafts the pitch.`;

export const metadata: Metadata = {
  // Makes relative URLs in the preview tags absolute (and an opengraph-image
  // file in src/app, once there is one).
  metadataBase: new URL("https://echolocate-topaz.vercel.app"),
  title: "Echolocate",
  description: TAGLINE,
  openGraph: {
    title: "Echolocate",
    description: PITCH,
    url: "/",
    siteName: "Echolocate",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Echolocate",
    description: PITCH,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
