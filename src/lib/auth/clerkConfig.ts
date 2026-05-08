export const isClerkConfigured =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && Boolean(process.env.CLERK_SECRET_KEY);

export const isClerkClientConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const clerkSignInUrl = '/login';
export const clerkSignUpUrl = '/signup';
export const clerkAfterAuthUrl = '/app/onboarding';
