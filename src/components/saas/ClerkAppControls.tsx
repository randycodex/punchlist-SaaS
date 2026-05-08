'use client';

import { OrganizationSwitcher, UserButton, useUser } from '@clerk/nextjs';
import { isClerkClientConfigured } from '@/lib/auth/clerkConfig';

function ClerkAppControlsInner() {
  const { isSignedIn } = useUser();

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <OrganizationSwitcher
        hidePersonal
        afterCreateOrganizationUrl="/app/onboarding"
        afterSelectOrganizationUrl="/app"
        appearance={{
          elements: {
            organizationSwitcherTrigger: 'rounded-full border border-black/5 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04]',
          },
        }}
      />
      <UserButton />
    </div>
  );
}

export default function ClerkAppControls() {
  if (!isClerkClientConfigured) {
    return null;
  }

  return <ClerkAppControlsInner />;
}
