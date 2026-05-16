# ISPANI Backend

Instant-job matching engine for South Africa.

## Tech Stack
- Node.js & Express
- Supabase (PostgreSQL + Auth)
- Upstash Redis (Geo-indexing + Real-time tracking)
- POPIA Compliant

## Project Structure
- `src/config`: Configuration for external services (Supabase, Redis)
- `src/modules`: Domain-driven modules (Jobs, Workers, Matching, Escrow, Tracking)
- `src/utils`: Helper functions and utilities (POPIA logic)

## Getting Started
1. Clone the repo
2. Install dependencies: `npm install`
3. Set up `.env` file (see `.env.example`)
4. Start the server: `npm start`
