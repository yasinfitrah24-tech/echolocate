// Page header and footer. Static, rendered on the server.

import Link from "next/link";
import { Wordmark } from "./logo";
import { linkClass } from "./styles";

const REPO_URL = "https://github.com/yasinfitrah24-tech/echolocate";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-control" aria-label="Echolocate, home">
          <Wordmark size={30} />
        </Link>
        <nav aria-label="Main" className="flex gap-5 text-sm font-medium">
          <a href="#how-it-works" className="hover:text-spot-ink hover:underline hover:underline-offset-4">
            How it works
          </a>
          <a href={REPO_URL} className="hover:text-spot-ink hover:underline hover:underline-offset-4">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-2 border-ink">
      <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-x-6 gap-y-3 px-4 pt-7 pb-10 text-sm text-ink-2 sm:px-6">
        <p>Echolocate ranks sponsors with Qloo taste data. Pitch emails are drafts: nothing is sent from this site.</p>
        <p>
          Built for the Qloo Agentic Hackathon · MIT ·{" "}
          <a href={REPO_URL} className={linkClass}>
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
