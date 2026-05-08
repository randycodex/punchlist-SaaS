import Link from 'next/link';
import { Building2, Camera, ClipboardCheck, FileText, Layers3, UsersRound } from 'lucide-react';
import PublicNav from '@/components/saas/PublicNav';
import PricingCards from '@/components/saas/PricingCards';

const features = [
  { icon: ClipboardCheck, title: 'Field punchlists', text: 'Track open work, corrections, and verified closeout items from the field.' },
  { icon: Layers3, title: 'Area-by-area inspections', text: 'Organize issues by project, area, location, item, and checkpoint.' },
  { icon: Camera, title: 'Photo documentation', text: 'Attach field photos and notes directly to the issue record.' },
  { icon: FileText, title: 'Branded PDF reports', text: 'Prepare client-ready exports with firm branding and report metadata.' },
  { icon: Building2, title: 'Firm customization', text: 'Prepare firm profiles, checklists, and report defaults for each workspace.' },
  { icon: UsersRound, title: 'Team collaboration', text: 'Structure the product around organizations, members, roles, and projects.' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f3ea] text-[#161a1d]">
      <PublicNav />
      <section className="relative min-h-[92vh] border-b border-black/10 pt-16">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,#f7f3ea_0%,#ece6da_48%,#d7e1de_100%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:py-28">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b3418]">Punchlist and field inspection SaaS</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.04] sm:text-6xl">
              Punchlist
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#41484d]">
              A commercial field inspection platform for architectural firms, construction teams, owners, and consultants who need structured issues, photos, notes, status tracking, and professional reports.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="rounded-md bg-[#161a1d] px-5 py-3 text-center text-sm font-semibold text-white hover:bg-[#2b3136]">
                Start free trial
              </Link>
              <Link href="/app" className="rounded-md border border-black/15 bg-white/60 px-5 py-3 text-center text-sm font-semibold text-[#161a1d] hover:bg-white">
                Open app preview
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-full rounded-lg border border-black/10 bg-white/80 p-4 shadow-sm">
              <div className="rounded-md border border-black/10 bg-[#fbfaf6] p-5">
                <div className="flex items-center justify-between border-b border-black/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b3418]">Field report</p>
                    <h2 className="mt-1 text-2xl font-semibold">Residential closeout inspection</h2>
                  </div>
                  <span className="rounded-md bg-[#e7efe9] px-3 py-1 text-xs font-semibold text-[#2f6847]">72% reviewed</span>
                </div>
                <div className="mt-5 grid gap-3">
                  {['Lobby millwork finish', 'Unit 8B window sealant', 'Roof drain protection'].map((item, index) => (
                    <div key={item} className="grid gap-3 rounded-md border border-black/10 bg-white p-4 sm:grid-cols-[1fr_auto]">
                      <div>
                        <p className="font-semibold">{item}</p>
                        <p className="mt-1 text-sm text-[#596167]">Photo, note, corrective status, and responsible party ready for export.</p>
                      </div>
                      <span className="self-start rounded-md bg-[#f2dfd4] px-3 py-1 text-xs font-semibold text-[#9b3418]">
                        Issue {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 bg-white py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold">Built for field documentation and closeout work.</h2>
            <p className="mt-4 text-base leading-7 text-[#596167]">
              Punchlist keeps inspections structured from the first site walk through final report delivery.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg border border-black/10 bg-[#fbfaf6] p-5">
                <Icon className="h-5 w-5 text-[#9b3418]" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#596167]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-semibold">For the teams responsible for project closeout.</h2>
            <p className="mt-4 text-base leading-7 text-[#596167]">
              The product language and workflow are aimed at professional field documentation, not generic task management.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {['Architectural firms', 'Construction administrators', 'Owner representatives', 'Developers', 'Consultants', 'Project teams'].map((audience) => (
              <div key={audience} className="rounded-lg border border-black/10 bg-white/70 p-4 text-sm font-semibold text-[#343a40]">
                {audience}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-3">
          {['Set up firm standards', 'Inspect by area', 'Export professional reports'].map((step, index) => (
            <div key={step}>
              <span className="text-sm font-semibold text-[#9b3418]">0{index + 1}</span>
              <h3 className="mt-3 text-2xl font-semibold">{step}</h3>
              <p className="mt-3 text-sm leading-6 text-[#596167]">
                {index === 0
                  ? 'Create a firm workspace with default report titles, branding, and checklist templates.'
                  : index === 1
                    ? 'Document issues, notes, photos, corrections, and status updates in the field.'
                    : 'Generate structured reports for clients, owners, contractors, and project teams.'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-black/10 bg-[#fbfaf6] py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="text-3xl font-semibold">Frequently asked questions</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              ['Is this replacing the existing PWA?', 'Phase 1 keeps the existing punchlist workflows and places them behind the new /app route.'],
              ['Are subscriptions active now?', 'No. Pricing is a front-end placeholder until billing and entitlement logic are implemented.'],
              ['Will firms have custom branding?', 'The settings shell is in place for logos, report titles, colors, and PDF branding.'],
              ['Does team access work yet?', 'No. Team invitations and organization roles are planned for the backend phase.'],
            ].map(([question, answer]) => (
              <article key={question} className="rounded-lg border border-black/10 bg-white p-5">
                <h3 className="font-semibold">{question}</h3>
                <p className="mt-2 text-sm leading-6 text-[#596167]">{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-3xl font-semibold">Pricing for individuals, teams, and firms.</h2>
              <p className="mt-3 text-[#596167]">Placeholder tiers for phase 1. Payments are not implemented yet.</p>
            </div>
            <Link href="/pricing" className="text-sm font-semibold text-[#9b3418]">View all pricing</Link>
          </div>
          <PricingCards compact />
        </div>
      </section>

      <section className="border-t border-black/10 bg-[#161a1d] py-16 text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="max-w-2xl text-3xl font-semibold">Prepare your inspection workflow for firm-wide project delivery.</h2>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="rounded-md bg-white px-5 py-3 text-center text-sm font-semibold text-[#161a1d]">Create account</Link>
            <Link href="/pricing" className="rounded-md border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white">Compare plans</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
