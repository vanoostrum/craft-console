# Vercel Authentication guards every deployment

Only the owner may open the deployed app. Vercel Authentication with the scope "All Deployments" protects the production domain and every preview. On the Hobby plan it is free (Vercel docs, read 2026-11-17). Only the owner's Vercel account gets in, unless the owner grants access: on Hobby to one external Vercel user, or with a Shareable Link or an automation bypass secret. So the app has no login code, no OAuth app, and no auth secrets.

## Considered options

"Sign in with GitHub" through Auth.js, allowed only for the GitHub user `vanoostrum`. It needs a GitHub OAuth app, three secrets, and login code with its own tests, for the same result.

## Consequences

The owner can let one other Vercel user in on Hobby. More people need a Vercel Pro team or a login in the app. The app itself never sees who is signed in.
