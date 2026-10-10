# Echolocate
Find sponsors your crowd already loves.

AI agent for small event organizers (campus, community). Input: artists or genre, city, audience age, crowd size.
Output: brands by category with a Sponsor Fit Score and reasons, local sponsors on a map, and a pitch pack (one-page PDF + email draft).

Stack: Next.js (App Router, TypeScript) on Vercel, Tailwind + shadcn, DeepSeek API, Leaflet + OpenStreetMap.

Qloo API
- Base URL: https://hackathon.api.qloo.com, header X-Api-Key
- GET /v2/insights needs filter.type. Flow: /search or /v2/tags -> IDs -> /v2/insights
- Wrong params are silently ignored. Do not use /recs.
- Each call takes about 1.5 s, so run calls in parallel.

Rules
- API keys live only in .env.local. Never commit keys or paste them in chat.
- Deadline: Oct 31, 11:45 China time. Target submit: Oct 30.