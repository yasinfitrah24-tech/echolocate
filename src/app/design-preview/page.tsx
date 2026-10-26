// Temporary design preview for the theme proposal (branch design/theme only).
// Static, no API calls. Data shown is copied from the saved example
// (src/data/demo/qloo-recording.json, 16 Oct). Delete before merging.

import type { Metadata } from "next";
import { archivo } from "../fonts";
import { LogoMark } from "@/components/logo";
import "./preview.css";

export const metadata: Metadata = {
  title: "Design preview · Echolocate",
  robots: { index: false, follow: false },
};

const SWATCHES = [
  { name: "paper", hex: "#F6F2EB", note: "page" },
  { name: "card", hex: "#FFFFFF", note: "cards, form" },
  { name: "ink", hex: "#1C1915", note: "text 15.7:1" },
  { name: "ink-2", hex: "#5C554D", note: "secondary 6.6:1" },
  { name: "spot", hex: "#D7265E", note: "buttons, white 4.85:1" },
  { name: "spot-ink", hex: "#A8164A", note: "links 6.5:1" },
  { name: "spot-tint", hex: "#FBE4EB", note: "highlights" },
  { name: "cafe", hex: "#A24B1C", note: "map" },
  { name: "clothing", hex: "#1B6B73", note: "map" },
  { name: "bar", hex: "#7D2338", note: "map, 21+ only" },
];

function Rings({ cx, cy }: { cx: string; cy: string }) {
  return (
    <svg className={"dp-rings"} aria-hidden="true" width="100%" height="100%">
      <g className={"dp-ringPulse"}>
        {[90, 170, 250, 330, 410, 490].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </svg>
  );
}

export default function DesignPreview() {
  return (
    <div className={`${archivo.variable} ${"dp-page"}`}>
      <div className={"dp-banner"}>
        <div className={"dp-wrap"}>Design preview, branch design/theme. Not part of the app; removed before merge.</div>
      </div>

      <header className={"dp-header"}>
        <div className={`${"dp-wrap"} ${"dp-headerRow"}`}>
          <a className={"dp-brand"} href="#">
            <LogoMark size={30} />
            <span className={"dp-wordmark"}>Echolocate</span>
          </a>
          <nav className={"dp-nav"} aria-label="Main">
            <a href="#how">How it works</a>
            <a href="https://github.com/yasinfitrah24-tech/echolocate">GitHub</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className={"dp-hero"}>
        <Rings cx="78%" cy="38%" />
        <div className={`${"dp-wrap"} ${"dp-heroGrid"}`}>
          <div>
            <h1 className={`${"dp-display"} ${"dp-h1"}`}>Sponsors for events too small to have a sponsorship team.</h1>
            <p className={"dp-sub"}>
              Pick your music and city, and Echolocate uses Qloo taste data to rank the brands and local shops your
              crowd likes, then drafts the pitch.
            </p>
            <p className={"dp-insight"}>Your event isn&rsquo;t in Qloo, but the music on your line-up is.</p>
            <div className={"dp-ctaRow"}>
              <a className={"dp-btnPrimary"} href="#results">
                Try an example
              </a>
              <a className={"dp-btnSecondary"} href="#how">
                Use your own event ↓
              </a>
              <p className={"dp-ctaNote"}>Instant: a saved search with real Qloo data.</p>
            </div>
          </div>

          {/* The saved example, set like a show flyer */}
          <div className={"dp-flyer"}>
            <div className={"dp-flyerEyebrow"}>Spring Quad Fest</div>
            <p className={`${"dp-display"} ${"dp-flyerHead"}`}>Phoebe Bridgers</p>
            <p className={`${"dp-display"} ${"dp-flyerSecond"}`}>boygenius · Clairo</p>
            <p className={"dp-flyerFacts"}>Austin, TX · all ages · about 800 people</p>
            <hr className={"dp-flyerRule"} />
            <p className={"dp-askLabel"}>Sponsors to ask first</p>
            <ul className={"dp-askList"}>
              <li className={"dp-askItem"}>
                <span className={`${"dp-score"} ${"dp-scoreTop"}`}>95</span>
                <span>
                  Urban Outfitters <small>· fashion</small>
                </span>
              </li>
              <li className={"dp-askItem"}>
                <span className={"dp-score"}>93</span>
                <span>
                  Buffalo Exchange <small>· retail</small>
                </span>
              </li>
              <li className={"dp-askItem"}>
                <span className={"dp-score"} style={{ background: "var(--color-clothing)" }}>
                  95
                </span>
                <span>
                  Monkies Vintage &amp; Thrift <small>· clothing store, 2.2 km from the center of Austin, TX</small>
                </span>
              </li>
            </ul>
            <div className={"dp-sourceTag"}>
              <span className={"dp-sourceDot"} /> Saved example · real Qloo data from Oct 16
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className={"dp-section"}>
        <div className={"dp-wrap"}>
          <p className={"dp-eyebrow"}>How it works</p>
          <h2 className={`${"dp-display"} ${"dp-h2"}`}>Three steps, then you send it.</h2>
          <div className={"dp-steps"}>
            <div className={"dp-step"}>
              <div className={"dp-stepNum"}>1</div>
              <h3 className={"dp-stepTitle"}>Describe the show</h3>
              <p className={"dp-stepBody"}>
                The kind of music or artists on the line-up, the city, who mostly comes, who is allowed in, how many.
              </p>
            </div>
            <div className={"dp-step"}>
              <div className={"dp-stepNum"}>2</div>
              <h3 className={"dp-stepTitle"}>Qloo ranks the sponsors</h3>
              <p className={"dp-stepBody"}>
                Brands and local shops that fans of that music like, each with its rank and the reason.
              </p>
            </div>
            <div className={"dp-step"}>
              <div className={"dp-stepNum"}>3</div>
              <h3 className={"dp-stepTitle"}>Send the ask</h3>
              <p className={"dp-stepBody"}>
                A pitch email or a one-page sponsor sheet for any of them. Edit the parts in [brackets], then send it
                yourself.
              </p>
            </div>
          </div>
          <p className={"dp-roleLine"}>Qloo picks who to ask. The AI only writes the email, from the facts Qloo gave.</p>
        </div>
      </section>

      {/* Results */}
      <section id="results" className={"dp-section"}>
        <div className={"dp-wrap"}>
          <div className={"dp-forFans"}>For fans of</div>
          <p className={`${"dp-display"} ${"dp-lineup"}`}>Phoebe Bridgers · boygenius · Clairo</p>
          <div className={"dp-chips"}>
            <span className={"dp-chip"}>Austin, TX</span>
            <span className={"dp-chip"}>About 800 people</span>
            <span className={"dp-chip"}>Mostly 24 and younger</span>
            <span className={"dp-chip"}>All ages</span>
          </div>
          <div className={"dp-metaRow"}>
            <span className={"dp-sourceTag"} style={{ marginTop: 0 }}>
              <span className={"dp-sourceDot"} /> Saved example · instant · real Qloo data from Oct 16
            </span>
            <a className={"dp-link"} href="#local">
              See local sponsors in Austin, TX
            </a>
            <a className={"dp-link"} href="#agent">
              How the agent got this
            </a>
          </div>
          <p className={"dp-note"}>
            75 brands in 11 categories. Sponsor Fit Score is our own score, not a Qloo number. It compares each brand
            with the others for the same crowd, so it only means something inside one search. It never goes above 95.
          </p>

          <div className={"dp-twoCol"}>
            <div className={"dp-card"}>
              <div className={"dp-cardHead"}>
                <h3 className={"dp-cardTitle"}>Fashion</h3>
                <span className={"dp-cardCount"}>27 brands</span>
              </div>
              <ul className={"dp-rows"}>
                {[
                  { score: 95, name: "Urban Outfitters", reason: "#1 of 46 brands Qloo matched to this crowd, across all categories. Leans toward Clairo fans.", top: true },
                  { score: 94, name: "UNIF", reason: "#2 of 46 brands Qloo matched to this crowd, across all categories." },
                  { score: 92, name: "Free People", reason: "#5 of 46 brands Qloo matched to this crowd, across all categories." },
                ].map((brand) => (
                  <li key={brand.name} className={"dp-row"}>
                    <span className={`${"dp-score"} ${brand.top ? "dp-scoreTop" : ""}`}>{brand.score}</span>
                    <div className={"dp-rowMain"}>
                      <p className={"dp-rowName"}>{brand.name}</p>
                      <p className={"dp-rowReason"}>{brand.reason}</p>
                      <div className={"dp-rowActions"}>
                        <button type="button" className={"dp-btnGhost"}>
                          Draft pitch
                        </button>
                        <button type="button" className={"dp-btnGhost"}>
                          Make one-pager
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className={"dp-letter"}>
                <div className={"dp-letterTop"}>
                  <span>Template draft · edit the parts in [brackets] before sending</span>
                  <button type="button" className={"dp-btnGhost"}>
                    Copy email
                  </button>
                </div>
                <p className={"dp-subject"}>Sponsorship idea for Urban Outfitters: Spring Quad Fest</p>
                <p className={"dp-body"}>
                  {`Hi [contact name],

I'm organizing Spring Quad Fest, an all-ages show in Austin, TX for about 800 people, mostly 24 and younger. The line-up is Phoebe Bridgers, Boygenius and Clairo.

I'm writing to Urban Outfitters specifically. Qloo's taste data shows that fans of this line-up already like your brand: Urban Outfitters ranks #1 of 46 brands Qloo matched to this crowd, across all categories.

We'd like to offer Urban Outfitters [a booth or sampling spot] and [logo placement on our posters and social posts]. Details are flexible.

Could we set up a 15-minute call this week?

Best,
[Your name]
[Event name / contact]`}
                </p>
              </div>
              <div className={"dp-card"} style={{ marginTop: 16 }}>
                <div className={"dp-loading"} role="status">
                  <span className={"dp-pulse"} aria-hidden="true">
                    <span />
                    <span />
                  </span>
                  Ranking brands for this crowd…
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Local sponsors */}
      <section id="local" className={"dp-section"}>
        <div className={"dp-wrap"}>
          <p className={"dp-eyebrow"}>Local sponsors</p>
          <h2 className={`${"dp-display"} ${"dp-h2"}`}>Near Austin, TX</h2>
          <div className={"dp-twoCol"}>
            <div className={"dp-card"}>
              <div className={"dp-mapBox"} aria-label="Map motif (the app uses an OpenStreetMap map here)">
                <svg viewBox="0 0 400 300" width="100%" height="100%" aria-hidden="true">
                  <circle cx="200" cy="150" r="128" fill="none" stroke="#1C1915" strokeOpacity="0.55" strokeDasharray="6 6" strokeWidth="1.5" />
                  <circle cx="200" cy="150" r="4" fill="#1C1915" />
                  <text x="208" y="146" fontSize="11" fill="#5C554D">center of Austin, TX</text>
                  <text x="200" y="292" fontSize="11" fill="#5C554D" textAnchor="middle">searched within 15 km</text>
                  <circle cx="176" cy="96" r="7" fill="#1B6B73" stroke="#fff" strokeWidth="2" />
                  <circle cx="232" cy="118" r="7" fill="#A24B1C" stroke="#fff" strokeWidth="2" />
                  <circle cx="150" cy="182" r="7" fill="#A24B1C" stroke="#fff" strokeWidth="2" />
                  <circle cx="262" cy="196" r="7" fill="#1B6B73" stroke="#fff" strokeWidth="2" />
                  <circle cx="214" cy="226" r="6" fill="#fff" stroke="#7A7268" strokeWidth="2.5" />
                  <circle cx="120" cy="120" r="6" fill="#fff" stroke="#7A7268" strokeWidth="2.5" />
                </svg>
              </div>
              <div className={"dp-legend"}>
                <span className={"dp-legendItem"}>
                  <span className={"dp-dot"} style={{ background: "var(--color-cafe)" }} /> Cafes
                </span>
                <span className={"dp-legendItem"}>
                  <span className={"dp-dot"} style={{ background: "var(--color-clothing)" }} /> Clothing stores
                </span>
                <span className={"dp-legendItem"}>
                  <span className={"dp-hollow"} /> Little taste data, no score
                </span>
                <span className={"dp-legendItem"}>
                  <span style={{ borderTop: "2px dashed #1C1915", width: 16, display: "inline-block" }} /> Area searched
                </span>
              </div>
            </div>

            <div className={"dp-card"}>
              <ul className={"dp-rows"}>
                <li className={"dp-row"}>
                  <span className={"dp-score"} style={{ background: "var(--color-clothing)" }}>
                    95
                  </span>
                  <div className={"dp-rowMain"}>
                    <p className={"dp-rowName"}>Monkies Vintage &amp; Thrift</p>
                    <p className={"dp-rowMeta"}>Clothing store · West Campus · 4.2★ · 2.2 km from the center of Austin, TX</p>
                    <p className={"dp-rowReason"}>#1 of 10 clothing stores for this crowd.</p>
                  </div>
                </li>
                <li className={"dp-row"}>
                  <span className={"dp-score"} style={{ background: "var(--color-cafe)" }}>
                    92
                  </span>
                  <div className={"dp-rowMain"}>
                    <p className={"dp-rowName"}>Bouldin Creek Cafe</p>
                    <p className={"dp-rowMeta"}>Cafe · 4.7★ · 5.8 km from the center of Austin, TX</p>
                    <p className={"dp-rowReason"}>#1 of 15 cafes for this crowd.</p>
                  </div>
                </li>
                <li className={"dp-row"}>
                  <span className={`${"dp-score"} ${"dp-scoreNone"}`}>–</span>
                  <div className={"dp-rowMain"}>
                    <p className={"dp-rowName"}>Ithaca Bakery</p>
                    <p className={"dp-rowMeta"}>Cafe · 0.5 km from the center of Ithaca, NY (example from another search)</p>
                    <p className={"dp-rowReason"}>Nearby · little taste data</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Agent panel */}
      <section id="agent" className={"dp-section"}>
        <div className={"dp-wrap"}>
          <p className={"dp-eyebrow"}>How the agent got this</p>
          <div className={"dp-card"} style={{ marginTop: 12 }}>
            <div className={"dp-agentSummary"}>
              8 Qloo calls · 75 brands · 20 places <span>Saved example: answered from the recording, no live calls</span>
            </div>
            <table className={"dp-table"}>
              <thead>
                <tr>
                  <th>Qloo endpoint</th>
                  <th>What it asked</th>
                  <th>Results</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["/search", "Artist search: Phoebe Bridgers", "3 results"],
                  ["/search", "Artist search: boygenius", "2 results"],
                  ["/search", "Artist search: Clairo", "3 results"],
                  ["/v2/insights", "Top brands for this crowd", "50 brands"],
                  ["/v2/insights", "Drinks brands", "15 brands"],
                  ["/v2/insights", "Financial services brands", "15 brands"],
                  ["/v2/insights", "Cafes within 15 km of Austin, TX", "15 places"],
                  ["/v2/insights", "Clothing stores within 15 km of Austin, TX", "10 places"],
                ].map(([endpoint, label, count]) => (
                  <tr key={label}>
                    <td>
                      <code>{endpoint}</code>
                    </td>
                    <td>{label}</td>
                    <td className={"dp-num"}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Tokens */}
      <section className={"dp-section"}>
        <div className={"dp-wrap"}>
          <p className={"dp-eyebrow"}>Tokens</p>
          <h2 className={`${"dp-display"} ${"dp-h2"}`}>Ink, paper and one spot colour.</h2>
          <div className={"dp-swatches"}>
            {SWATCHES.map((swatch) => (
              <div key={swatch.name} className={"dp-swatch"}>
                <div className={"dp-swatchColor"} style={{ background: swatch.hex }} />
                <div className={"dp-swatchText"}>
                  <b>{swatch.name}</b>
                  {swatch.hex} · {swatch.note}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 28 }}>
            <div className={"dp-typeRow"}>
              <small>Display 56 · 75% · 800</small>
              <span className={"dp-display"} style={{ fontSize: 56 }}>
                Sponsors to ask
              </span>
            </div>
            <div className={"dp-typeRow"}>
              <small>Line-up 32 · caps</small>
              <span className={"dp-display"} style={{ fontSize: 32, textTransform: "uppercase" }}>
                Phoebe Bridgers · Clairo
              </span>
            </div>
            <div className={"dp-typeRow"}>
              <small>Body 16 · 400</small>
              <span>Qloo picks who to ask. The AI only writes the email, from the facts Qloo gave.</span>
            </div>
            <div className={"dp-typeRow"}>
              <small>Small 13 · 500</small>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink-2)" }}>
                Sponsor Fit Score is our own score, not a Qloo number.
              </span>
            </div>
            <div className={"dp-typeRow"}>
              <small>Scores · tabular</small>
              <span style={{ display: "flex", gap: 8 }}>
                <span className={`${"dp-score"} ${"dp-scoreTop"}`}>95</span>
                <span className={"dp-score"}>68</span>
                <span className={"dp-score"}>54</span>
                <span className={`${"dp-score"} ${"dp-scoreNone"}`}>–</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className={"dp-footer"}>
        <div className={`${"dp-wrap"} ${"dp-footerRow"}`}>
          <span>
            Echolocate ranks sponsors with Qloo taste data. Pitch emails are drafts: nothing is sent from this site.
          </span>
          <span>Built for the Qloo Agentic Hackathon · MIT · GitHub</span>
        </div>
      </footer>
    </div>
  );
}
