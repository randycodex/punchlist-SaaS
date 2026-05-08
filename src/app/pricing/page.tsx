import PublicNav from '@/components/saas/PublicNav';
import PricingCards from '@/components/saas/PricingCards';

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#161a1d]">
      <PublicNav />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-32 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b3418]">Pricing</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">Plans for solo inspectors, project teams, and firm-wide rollout.</h1>
          <p className="mt-5 text-base leading-7 text-[#596167]">
            These prices are placeholders for the SaaS shell. Stripe, subscription enforcement, and billing portal flows are intentionally deferred.
          </p>
        </div>
        <div className="mt-12">
          <PricingCards />
        </div>
      </section>
    </main>
  );
}
