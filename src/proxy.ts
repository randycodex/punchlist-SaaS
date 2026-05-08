import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { clerkAfterAuthUrl, clerkSignInUrl, clerkSignUpUrl, isClerkConfigured } from '@/lib/auth/clerkConfig';

const isProtectedRoute = createRouteMatcher(['/app(.*)']);

const protectedClerkMiddleware = clerkMiddleware(
  async (auth, request) => {
    if (isProtectedRoute(request)) {
      await auth.protect();
    }
  },
  {
    signInUrl: clerkSignInUrl,
    signUpUrl: clerkSignUpUrl,
    afterSignInUrl: clerkAfterAuthUrl,
    afterSignUpUrl: clerkAfterAuthUrl,
  }
);

export default function proxy(request: Parameters<typeof protectedClerkMiddleware>[0], event: Parameters<typeof protectedClerkMiddleware>[1]) {
  if (!isClerkConfigured) {
    return NextResponse.next();
  }

  return protectedClerkMiddleware(request, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
