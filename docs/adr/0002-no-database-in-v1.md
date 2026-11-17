# No database in v1

v1 reads the transcript bucket and Linear on each request, and caches the result for a few minutes. It keeps no copy of the data. The pages need only the small `metadata.json` file of each session: about 35 sessions and 55 MiB in the bucket on 2026-11-17. The Vercel Hobby plan allows functions of up to 300 seconds with 2 GB of memory (read 2026-11-17), which is far more than these reads need.

## Consequences

A copy of the data, such as Vercel Blob or a Postgres database, is a later ticket. It is needed only if reading on request gets too slow as the sessions grow.
