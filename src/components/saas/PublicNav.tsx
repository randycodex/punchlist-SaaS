import Link from 'next/link';

export default function PublicNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-black/10 bg-[#f7f3ea]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="text-base font-semibold text-[#161a1d]">
          Punchlist
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-[#4f565d] md:flex">
          <Link href="/pricing" className="hover:text-[#161a1d]">Pricing</Link>
          <Link href="/login" className="hover:text-[#161a1d]">Login</Link>
          <Link href="/app" className="hover:text-[#161a1d]">Open app</Link>
        </nav>
        <Link
          href="/signup"
          className="rounded-md bg-[#161a1d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b3136]"
        >
          Start trial
        </Link>
      </div>
    </header>
  );
}
