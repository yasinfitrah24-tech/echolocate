import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SponsorFinder } from "@/components/sponsor-finder";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <SponsorFinder />
      <SiteFooter />
    </>
  );
}
