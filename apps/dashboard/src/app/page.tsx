import { SiteHeader } from "@/components/landing/site-header";
import { HeroSection } from "@/components/landing/hero-section";
import { ImpactSection } from "@/components/landing/impact-section";
import { ProductSection } from "@/components/landing/product-section";
import { MethodSection } from "@/components/landing/method-section";
import { EvidenceSection } from "@/components/landing/evidence-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-[#090A0A] text-[#F0F2ED]">
      <SiteHeader />
      <main className="flex-1 w-full min-w-0 overflow-x-hidden">
        <HeroSection />
        <ImpactSection />
        <ProductSection />
        <MethodSection />
        <EvidenceSection />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}
