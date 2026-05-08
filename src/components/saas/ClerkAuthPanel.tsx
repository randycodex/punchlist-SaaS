import { SignIn, SignUp } from '@clerk/nextjs';
import { isClerkConfigured } from '@/lib/auth/clerkConfig';

function PlaceholderAuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup';

  return (
    <>
      <h2 className="text-2xl font-semibold text-[#161a1d]">{isSignup ? 'Create account' : 'Log in'}</h2>
      <div className="mt-6 space-y-4">
        <input className="w-full rounded-md border border-black/10 px-4 py-3 text-sm" placeholder={isSignup ? 'Work email' : 'Email address'} type="email" />
        {isSignup ? <input className="w-full rounded-md border border-black/10 px-4 py-3 text-sm" placeholder="Full name" /> : null}
        {isSignup ? <input className="w-full rounded-md border border-black/10 px-4 py-3 text-sm" placeholder="Firm or company" /> : null}
        <input className="w-full rounded-md border border-black/10 px-4 py-3 text-sm" placeholder="Password" type="password" />
        <button className="w-full rounded-md bg-[#161a1d] px-4 py-3 text-sm font-semibold text-white">
          {isSignup ? 'Create workspace' : 'Continue'}
        </button>
      </div>
      <p className="mt-4 rounded-md bg-[#f7f3ea] p-3 text-xs leading-5 text-[#596167]">
        Add Clerk environment variables to activate real authentication.
      </p>
    </>
  );
}

export default function ClerkAuthPanel({ mode }: { mode: 'login' | 'signup' }) {
  if (!isClerkConfigured) {
    return <PlaceholderAuthForm mode={mode} />;
  }

  if (mode === 'signup') {
    return (
      <SignUp
        routing="path"
        path="/signup"
        signInUrl="/login"
        fallbackRedirectUrl="/app/onboarding"
      />
    );
  }

  return (
    <SignIn
      routing="path"
      path="/login"
      signUpUrl="/signup"
      fallbackRedirectUrl="/app"
    />
  );
}
