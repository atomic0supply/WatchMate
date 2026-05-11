# WatchMate

Personal taste tracker and AI-driven recommender for movies and series.
Built with React + Vite + Tailwind, Firebase (Auth, Firestore, Hosting) and
Google Gemini via Firebase Cloud Functions.

## Architecture

- **Client** (`src/`): React 19 SPA. Talks to Firebase Auth + Firestore directly.
  AI calls go through callable Cloud Functions — the Gemini API key never reaches
  the browser.
- **Functions** (`functions/`): Firebase Functions v2 (Node 20). Two callables:
  - `generateTasteProfile` — summarises user history into a taste profile.
  - `generateAIRecommendations` — returns 12 ranked recommendations.
  The Gemini API key is stored in Google Secret Manager and injected at runtime.
- **Firebase project**: `watchmate-3ef1b` (uses the `(default)` Firestore database).

## Local setup

Prereqs: Node.js 20+, npm, and the Firebase CLI (`npm i -g firebase-tools`).

```bash
npm install
npm --prefix functions install
```

Set the Gemini API key as a secret on Functions (one time):

```bash
firebase login
firebase use watchmate-3ef1b
firebase functions:secrets:set GEMINI_API_KEY
```

Then either run against the deployed project:

```bash
npm run dev
```

…or against the local emulators (Auth + Firestore + Functions):

```bash
firebase emulators:start
# in another shell:
npm run dev
```

The TMDB client key (optional, used for poster/metadata fetch) goes in
`.env.local` as `VITE_TMDB_API_KEY`.

## Deploy

```bash
npm run build                              # build the SPA into dist/
firebase deploy --only firestore:rules     # publish security rules
firebase deploy --only functions           # publish AI callables
firebase deploy --only hosting             # publish the SPA
```

`firebase deploy` (no flags) will do all three.

> Cloud Functions for Firebase requires the **Blaze** (pay-as-you-go) billing
> plan. The free tier covers low usage.
