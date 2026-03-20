This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Microsoft OneDrive Sync

This app uses each signed-in user's own OneDrive account. Projects stay local in the browser until
the user signs in, then sync is done against that user's `PunchList` folder in OneDrive.

For multi-user use on phones or desktops inside UAI, configure one Microsoft Entra app for the
UAI tenant, then set:

```
NEXT_PUBLIC_MS_CLIENT_ID=your_microsoft_app_client_id
NEXT_PUBLIC_MS_TENANT_ID=your_uai_tenant_id
NEXT_PUBLIC_MS_REDIRECT_URI=https://punchlist-pwa.vercel.app/
```

Notes:

- `NEXT_PUBLIC_MS_TENANT_ID` should be your UAI tenant ID when only UAI work accounts should sign
  in.
- The app registration should stay single-tenant and include every production and development
  redirect URI you plan to use.
- Users will sync to their own OneDrive files. This is per-user storage, not a shared team drive.

After updating env vars, restart the dev server or redeploy.

## Self-hosted Inter font

Add the Inter variable font file at:

```
public/fonts/Inter-Variable.woff2
```

This avoids fetching Google Fonts during build.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
