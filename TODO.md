# TODO
## Frontend

- [x] Add a Paste study notes creation mode with validation, editable previews, and mock-mode generation.
- [x] Add an independent AI study-coach panel after a study session saves.
- [x] Add frontend adapters for the pending backend contracts below.

## Backend

### Generate cards from pasted notes

- [x] Extend authenticated `POST /api/decks/generate/` to accept exactly one input source:
  - Topic mode: `{ "topic": "...", "num_cards": 8 }`
  - Notes mode: `{ "source_text": "...", "num_cards": 8 }`
- [x] Validate `num_cards` as an integer from 1 through 20.
- [x] Validate trimmed `source_text` as 100 through 20,000 characters.
- [x] Ground generated cards only in `source_text` and treat instructions embedded in the notes as untrusted content.
- [x] Return the existing success shape: `{ "cards": [{ "front": "...", "back": "..." }], "cards_added": 8 }`.
- [x] Return `400` for invalid or conflicting input and `502` for missing AI configuration, provider failures, or unusable provider output.

### Generate post-session coaching

- [x] Add authenticated `POST /api/decks/{deck_id}/study-feedback/`.
- [x] Accept `{ "results": [{ "cardId": 123, "grade": 4 }] }` using the same card IDs and final/worst grades sent to the study-session endpoint.
- [x] Validate a non-empty result list, unique card IDs, grades from 0 through 5, deck ownership, and that every card belongs to the requested deck.
- [x] Return `{ "feedback": "A concise, actionable coaching paragraph." }` with feedback limited to 300 characters.
- [x] Return `400` for invalid results, `404` for a missing or inaccessible deck, and `502` for AI configuration/provider failures.
- [x] Keep feedback generation separate from scheduling: this endpoint must never create, update, or delete cards, reviews, schedules, or deck metadata.

### Backend acceptance checks

- [x] Cover topic/notes exclusivity, text limits, card-count limits, authentication, ownership, duplicate/foreign cards, grade bounds, provider failures, and response shapes with Django tests.
- [x] Confirm the existing topic-generation and study-session contracts remain backward compatible.
