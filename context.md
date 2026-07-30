# CardSparks Hackathon Context

## One-sentence pitch

CardSparks turns a topic, pasted notes, documents, or a camera scan into an editable study system that schedules reviews, targets weak spots, tests understanding, and explains what to do next.

## The problem

Students lose time converting material into study resources, then receive little guidance about which cards deserve attention. Most flashcard tools separate creation, scheduling, testing, analytics, and feedback into disconnected workflows.

CardSparks connects those stages. The product is not simply an AI flashcard generator: it is a feedback loop from source material to measurable recall.

## Intended users

- Students preparing for exams
- Language learners
- Learners working from lecture notes, worksheets, readings, or study guides
- Teachers or study groups sharing reusable decks

## Current product story

1. A learner signs up or enters the self-contained demo mode.
2. They create cards manually, generate from a topic, paste notes, import a document, or scan a page with their camera.
3. Every generated card remains editable before it is saved.
4. The learner studies with an SM-2-style spaced-repetition schedule.
5. Missed cards repeat during the session and influence the saved schedule.
6. Progress analytics identify difficult cards and weak decks.
7. Weak-spots practice builds a temporary cross-deck recovery session.
8. Practice-test mode converts material into a timed, shuffled exam and keeps results separate from scheduling unless the learner opts in.
9. AI coaching and card-quality checking provide optional guidance without silently rewriting cards or corrupting review history.
10. Decks can be organized, exported, or shared as privacy-conscious read-only copies.

## Implemented features

### Creation and import

- Manual deck and card creation
- Topic-based AI generation
- Pasted-notes AI generation
- Local PDF, DOCX, TXT, and Markdown extraction
- Browser-side OCR for PNG, JPG, and WebP images
- Mobile camera capture for worksheets, pages, and handwriting
- Editable generation previews
- Basic, reversible, multiple-choice, cloze, and image-reference cards

### Studying

- SM-2-style spaced repetition
- Four-grade and simplified grading modes
- Daily account limits and per-deck overrides
- In-session repetition for missed cards
- Worst-grade scheduling so a later correct retry does not hide an earlier miss
- Cross-deck weak-spots practice
- Timed, shuffled practice tests
- Automatic multiple-choice conversion for test mode
- Final scores and answer review
- Optional application of test results to the study schedule
- Independent post-session AI coaching

### Organization and management

- Search across decks, metadata, and card contents
- Folders and tags
- Table-style bulk editor
- Multi-select deletion
- Atomic card movement that preserves review history
- Bulk card-type conversion
- Bulk deck-tag operations
- AI card-quality analysis with individually accepted rewrites

### Transfer and sharing

- CSV import and export
- Anki-compatible TSV export and import
- JSON content backups
- Import previews with validation errors
- Duplicate detection and skipping
- Public read-only deck links
- Community deck library
- Independent duplication of shared decks

### Progress and account experience

- Landing and welcome page
- Token-based signup and login
- Protected learner routes
- Today dashboard with reviews, new cards, streak, and estimated time
- Retention trend
- Review heatmap
- Upcoming workload forecast
- Weakest decks and difficult cards
- Streak history
- Responsive desktop/mobile design
- Light and dark themes
- Mock mode backed by browser storage

## Recommended hackathon demo flow

Keep the primary walkthrough under three minutes:

1. Start on the landing page and state the problem in one sentence.
2. Open the notes creation mode and scan or import a page.
3. Generate cards and edit one result to demonstrate human control.
4. Save the deck and show its different card types.
5. Complete a short study interaction and intentionally miss one card.
6. Show the saved-session summary and AI coach.
7. Open Progress and launch **Practice weak cards**.
8. Open practice-test mode and show that exam results do not alter scheduling without consent.
9. Finish with public sharing or the transfer center.

The central demo message should be:

> CardSparks does not stop after generating cards. It observes recall, finds weak spots, and turns them into the learner's next action.

## Technical architecture

### Frontend

- React 19
- React Router
- Vite
- PDF.js for browser-side PDF text extraction
- Mammoth for DOCX text extraction
- Tesseract.js for browser-side OCR
- Real and mock API adapters behind one application context
- Browser storage for demo-mode persistence
- Node's built-in test runner

### Backend

- Python
- Django 6
- Django REST Framework
- DRF token authentication
- SQLite for local development
- Mistral API for optional generation, coaching, and card-quality analysis
- Transactional scheduling and atomic card movement

## Important engineering decisions

- Generated cards are drafts; AI output is never saved without learner review.
- Study scheduling saves before optional AI coaching begins.
- Coaching failure cannot retry or invalidate a completed session.
- Cross-deck practice retries only unsaved deck groups after a partial network failure.
- Practice-test results are isolated unless the learner explicitly applies them.
- Public deck responses exclude email addresses and personal study history.
- Moving a card updates its deck instead of copying and deleting it, preserving reviews and scheduling fields.
- Files and photos are parsed in the browser. Original source files are not uploaded by CardSparks.
- Import/export currently runs in the frontend and does not depend on unfinished backend transfer endpoints.

## Verification status

- 30 frontend unit tests passing
- 39 Django tests passing
- Frontend production build passing
- Django system check passing
- No missing migrations
- Source encoding and debug-statement scan clean
- Latest feature commit on `main`: `0af1ea6 Add advanced study and deck workflows`

## Known limitations and honest demo notes

- Real AI features require `MISTRAL_API_KEY`; mock mode provides deterministic demo behavior.
- OCR performs best on bright, straight, high-contrast pages. Handwriting accuracy varies.
- Tesseract may download its English recognition data the first time OCR runs.
- Image cards currently use image URLs rather than uploaded image storage.
- JSON import restores deck content through current APIs; full server-side schedule/history restoration is not yet an import contract.
- SQLite is the local-development database, not the intended production database.
- The repository currently reports a React Router advisory concerning React Server Components. CardSparks does not use RSC mode, and the automated npm fix proposes a breaking downgrade.
- A public deployment URL, final hackathon category, team credits, and sponsor disclosures still require team confirmation.

## Accuracy guardrails for the project page

Do not claim that:

- OCR is perfect for handwriting.
- Import/export has completed backend persistence or restores review history.
- Public decks support collaborative editing.
- Image cards upload image files.
- AI controls or can silently change SM-2 scheduling.
- Roadmap items in `ideas.md` are already implemented.
- CardSparks is deployed until a working public URL is confirmed.

## Repository and missing submission details

- Repository: https://github.com/SahilKDas/CardSparks
- Live deployment: **Team input required**
- Demo video: **Team input required**
- Hackathon name and categories: **Team input required**
- Team member names, Devpost accounts, and contribution summaries: **Team input required**
- Sponsor technology disclosures: **Team input required**

