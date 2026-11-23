# Pilot capacity

The global social limit is **120 visitors in groups of six**. Individual browsing has no reserved seats. A free, guaranteed simultaneous audience cannot be inferred from these tests. Video transfer, monthly quotas and concentration of arrivals determine how a launch performs.

## Isolated load test

Run date: 2026-11-23. Docker on the development machine, 1,024 published rooms and 4,096 synthetic works. The gateway, database, static HTTP server and load generator shared the machine. The database used the Docker host's shared resource allocation. The edge runtime reused workers.

Chrome recorded the request set of each cold entry. Virtual visitors fetched that resource set and the applicable public API. Public metadata reads use the application's bounded retry. The 3D destination was Orbital Matter. The artist room displayed four uploaded images. These timings measure HTTP delivery on loopback. Thousands of GPUs, Internet transit and the production CDN were outside the test.

| Arrival pattern | Completed visits | p95 of completed visits |
| --- | ---: | ---: |
| Catalogue, 100 at once | 100 / 100 | 2,242 ms |
| Catalogue, 500 at once | 420 / 500 | 8,160 ms |
| Catalogue, 1,000 at once | 780 / 1,000 | 17,363 ms |
| Catalogue, 1,000 over 30 seconds | 1,000 / 1,000 | 36 ms |
| Inaugural 3D room, 100 at once | 100 / 100 | 1,901 ms |
| Inaugural 3D room, 500 at once | 332 / 500 | 6,833 ms |
| Inaugural 3D room, 1,000 at once | 628 / 1,000 | 13,191 ms |
| Inaugural 3D room, 1,000 over 30 seconds | 1,000 / 1,000 | 79 ms |
| Artist 3D room, 100 at once | 97 / 100 | 3,699 ms |
| Artist 3D room, 500 at once | 202 / 500 | 15,287 ms |
| Artist 3D room, 1,000 at once | 197 / 1,000 | 11,047 ms |
| Artist 3D room, 1,000 over 30 seconds | 1,000 / 1,000 | 1,010 ms |

An instantaneous burst produced socket or gateway failures even with a warmed catalogue. Opening a curated room directly requires static assets only. A temporary database or community catalogue failure leaves the inaugural exhibitions accessible while the static host is available.

## Transfer and shared visits

Cold catalogue static files: 331,796 bytes. Orbital 3D entry: 647,243 bytes. The artist room transferred 439,892 bytes, including 35,110 bytes for image previews. The same source images previously transferred 170,612 bytes. Audio, video and full-resolution works are fetched on request. Other inaugural interiors have different model sizes.

Of 160 simultaneous social requests, 120 entered 20 groups and 40 received the full-capacity response. Movement updates completed 2,640 / 2,640 requests, p95 14 ms. A six-person update with all peers stationary and no new chat returned 2 payload bytes. A changed peer snapshot measured 361 bytes in the sample. Headers and TLS add overhead. Leases expire after 100 seconds without renewal.

Voice was verified separately between two accounts. The application permits one simultaneous speaker per group, up to six globally, with a daily allowance of 10,000 recipient packets or an estimated 40 MiB. Visitors use optional voice channels; chat and movement use separate database calls.

## What a viral post can consume

GitHub Pages publishes a soft 100 GB monthly bandwidth limit. Supabase Free includes separate monthly allowances of 5 GB uncached egress and 5 GB cached egress, 1 GB of file storage and 500,000 Edge Function invocations. A thousand complete plays of a 10 MB user video transfer about 10 GB. A cached response from a warm function still involves an invocation when the request reaches that function. A cached browser response can avoid the invocation. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [Supabase](https://supabase.com/pricing).

If video dominates transfer, move artist media to a separately budgeted object store/CDN and add adaptive video renditions before raising social limits. A sponsored exhibition can fund delivery while artists retain free rooms. The current deployment uses the existing free services.

## Reproduce locally

Install dependencies and start Supabase Docker. Apply the migrations, start the local functions runtime with reusable workers, then run the harness in a second terminal. The harness accepts only the loopback stack and removes its fixtures. CHROME_PATH selects an installed Chrome. For the constrained database run, apply the container limit before starting the test.

```sh
npm ci
supabase start
supabase migration up --local
docker update --cpus 1 --memory 512m --memory-swap 1g supabase_db_umbral-gallery
supabase functions serve
```

```sh
node scripts/load-gallery.mjs
```
