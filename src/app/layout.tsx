import type { Metadata } from "next";
import { archivo } from "./fonts";
import "./globals.css";

const TAGLINE = "Sponsors for events too small to have a sponsorship team.";
// The approved elevator pitch (16 Oct), used for link previews (Devpost, chat apps).
const PITCH = `${TAGLINE} Pick your music and city, and Echolocate uses Qloo taste data to rank the brands and local shops your crowd likes, then drafts the pitch.`;

export const metadata: Metadata = {
  // Makes relative URLs in the preview tags absolute, including the preview
  // image (src/app/opengraph-image.png and twitter-image.png, 1200x630).
  metadataBase: new URL("https://echolocate-topaz.vercel.app"),
  title: `Echolocate · ${TAGLINE.replace(/\.$/, "")}`,
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
    card: "summary_large_image",
    title: "Echolocate",
    description: PITCH,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}
