# Vercel Authentication guards every deployment

Only the owner may open the deployed app. Vercel Authentication with the scope "All Deployments" protects the production domain and every preview. On the Hobby plan it is free, and only the owner's Vercel account can pass it (Vercel docs, read 2026-11-17). So the app has no login code, no OAuth app, and no auth secrets.

## Considered options

"Sign in with GitHub" through Auth.js, allowed only for the GitHub user `vanoostrum`. It needs a GitHub OAuth app, three secrets, and login code with its own tests, for the same result.

## Consequences

To share the app with another person, the project needs a Vercel Pro team or a login in the app.
