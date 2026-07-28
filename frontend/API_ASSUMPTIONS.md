# Frontend API assumptions

This document describes the contract shared by the React client and the Django REST Framework backend in this repository.

## Switching between mock and DRF

The app defaults to `VITE_USE_MOCK_API=true`. In this mode, all data is stored under `cardsparks.demo.decks` in browser `localStorage`; no network requests are made.

Set `VITE_USE_MOCK_API=false` to enable DRF. The client prefixes every route below with `VITE_API_BASE_URL` and sends JSON with `Accept: application/json` and `Content-Type: application/json`.

If `cardsparks.auth.token` exists, requests include:

```http
Authorization: Token <token>
```

If the backend uses JWT, change the prefix to `Bearer` in `src/services/api.js`. If it uses Django session auth, add `credentials: 'include'` to `request()` and expose a CSRF token.

## Deck shape

The frontend normalizes snake_case and camelCase for read responses. Its internal shape is:

```json
{
  "id": "42",
  "title": "Cell Biology Essentials",
  "description": "Core structures and processes.",
  "emoji": "🧬",
  "color": "coral",
  "lastStudied": "2026-07-26T19:20:00Z",
  "createdAt": "2026-07-18T10:00:00Z",
  "updatedAt": "2026-07-26T19:20:00Z",
  "cards": [
    {
      "id": "201",
      "front": "What do mitochondria produce?",
      "back": "ATP through cellular respiration.",
      "mastery": 0.8
    }
  ]
}
```

Accepted read aliases are `name` for `title`, `flashcards` for `cards`, `question` for `front`, `answer` for `back`, and snake_case timestamps. `mastery` is expected as a number from `0` to `1`.

## Required routes

### Decks

- `GET /api/decks/` — returns either an array or DRF pagination with a `results` array. Deck cards may be embedded. If only `card_count` is returned, the dashboard count works but mastery requires embedded cards or a separate stats field.
- `GET /api/decks/:id/` — returns one deck with an embedded `cards` or `flashcards` array.
- `POST /api/decks/` — accepts deck metadata and a `cards` array. The AI preview flow deliberately creates the deck only after the learner reviews its cards.
- `PATCH /api/decks/:id/` — updates title and description.
- `DELETE /api/decks/:id/` — returns `204 No Content`.

### Cards

- `POST /api/decks/:id/cards/` — accepts `{ "front": "...", "back": "..." }` and returns the created card.
- `PATCH /api/cards/:id/` — updates front/back text and returns the updated card.
- `DELETE /api/cards/:id/` — returns `204 No Content`.

### AI generation

Preview before deck creation:

```http
POST /api/decks/generate/
Content-Type: application/json

{
  "topic": "Spanish past-tense verbs with examples",
  "num_cards": 8,
  "preview": true
}
```

Expected response:

```json
{
  "cards": [
    { "front": "...", "back": "..." }
  ]
}
```

Generation into an existing deck is assumed to use:

```http
POST /api/decks/:id/generate/

{ "topic": "Focus on irregular verbs", "num_cards": 5 }
```

It should return the updated deck, either directly or under `{ "deck": ... }`. If the backend instead has only `/api/decks/generate/`, adjust `generateIntoDeck()` in `src/services/api.js` to send `deck_id` there.

### Study progress

```http
POST /api/decks/:id/study-sessions/

{
  "results": [
    { "cardId": "201", "correct": true },
    { "cardId": "202", "correct": false }
  ]
}
```

The client accepts the updated deck directly or under `{ "deck": ... }`. The session sends grades from `0` to `5`, stores review history, and updates the SM-2 schedule. Demo mode applies the same scheduling rules locally.

### Authentication

- `POST /api/auth/login/` with `{ "email": "...", "password": "..." }`
- `POST /api/auth/signup/` with `{ "name": "...", "email": "...", "password": "..." }`

The client recognizes a token in `token`, `key`, or `access`; the current backend returns `token` and a `user` object. Learner routes require authentication in both API and UI layers.

## Error and CORS behavior

- JSON errors may use `detail`, `message`, or DRF field-error arrays.
- Requests time out after 8.5 seconds and surface a recoverable error banner.
- The backend should allow the configured Vite origin through `django-cors-headers` (or an equivalent policy).
- All list/detail endpoints should enforce ownership server-side; UI filtering is not an authorization boundary.

