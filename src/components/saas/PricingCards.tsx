import Link from 'next/link';

const tiers = [
  {
    name: 'Individual',
    price: '$19',
    description: 'For solo architects, inspectors, and consultants.',
    features: ['Unlimited local projects', 'Photo-backed issue tracking', 'Professional PDF exports', 'Core inspection templates'],
  },
  {
    name: 'Team',
    price: '$59',
    description: 'For small architectural and construction teams.',
    features: ['Shared firm workspace', 'Team project visibility', 'Custom checklist templates', 'Branded report settings'],
    highlighted: true,
  },
  {
    name: 'Firm / Enterprise',
    price: 'Custom',
    description: 'For larger firms that need admin controls and support.',
    features: ['Advanced roles', 'Firm-wide templates', 'Priority support', 'Storage and export options'],
  },
];

export default function PricingCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {tiers.map((tier) => (
        <section
          key={tier.name}
          className={`rounded-lg border p-6 ${
            tier.highlighted
              ? 'border-[#e45a2c] bg-white shadow-sm'
              : 'border-black/10 bg-white/70'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-[#161a1d]">{tier.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[#596167]">{tier.description}</p>
            </div>
            {tier.highlighted ? (
              <span className="rounded-md bg-[#f2dfd4] px-2.5 py-1 text-xs font-semibold text-[#9b3418]">Popular</span>
            ) : null}
          </div>
          <div className="mt-6 flex items-end gap-1">
            <span className="text-4xl font-semibold text-[#161a1d]">{tier.price}</span>
            {tier.price !== 'Custom' ? <span className="pb-1 text-sm text-[#596167]">/mo</span> : null}
          </div>
          <ul className="mt-6 space-y-3 text-sm text-[#343a40]">
            {tier.features.slice(0, compact ? 3 : tier.features.length).map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#e45a2c]" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className={`mt-7 inline-flex w-full justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition ${
              tier.highlighted
                ? 'bg-[#161a1d] text-white hover:bg-[#2b3136]'
                : 'border border-black/10 text-[#161a1d] hover:bg-white'
            }`}
          >
            {tier.price === 'Custom' ? 'Contact sales' : 'Choose plan'}
          </Link>
        </section>
      ))}
    </div>
  );
}
