// Page header and footer. Static, rendered on the server.

import Link from "next/link";
import { Wordmark } from "./logo";

const REPO_URL = "https://github.com/yasinfitrah24-tech/echolocate";

/** The standard GitHub mark, in the current text colour. */
function GitHubMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1312px] items-center justify-between gap-4 px-5 py-4 md:px-16">
        <Link href="/" className="rounded-field" aria-label="Echolocate, home">
          <Wordmark size={30} />
        </Link>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Echolocate on GitHub (opens in a new tab)"
          className="grid size-11 place-items-center rounded-full text-ink hover:bg-accent-tint"
        >
          <GitHubMark />
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-card">
      <div className="mx-auto flex max-w-[1312px] flex-wrap justify-between gap-x-6 gap-y-2 px-5 py-6 text-sm text-ink-3 md:px-16">
        <p>Echolocate · Built for the Qloo Agentic Hackathon</p>
        <p className="flex flex-wrap gap-x-4">
          <span>Taste data by Qloo</span>{" "}
          <span>Map © OpenStreetMap contributors</span>
        </p>
      </div>
    </footer>
  );
}
