# CardSparks Hackathon Ideas

These ideas are ranked for a hackathon, where a clear story, a memorable live demo, visible technical depth, and reliable execution matter more than building a large production backlog.

## Recommended strategy

Do not attempt every idea. Choose:

- **One flagship feature** that strengthens the pitch
- **One small visual payoff** judges can understand instantly
- **One reliability/polish pass** so the demo feels finished

The recommended package is:

1. **Adaptive Exam Countdown Planner** as the flagship
2. **Misconception Detective** as the AI moment
3. **Shareable Study Result** as the visual payoff

## 1. Adaptive Exam Countdown Planner

**Pitch:** “Tell CardSparks when the exam is and how much time you have. It builds the plan.”

Let a learner choose an exam date, relevant decks, available days, and minutes per day. CardSparks would combine due dates, mastery, lapses, deck size, and forecast workload into a daily plan.

### Demo moment

Enter “Biology exam Friday, 20 minutes per day” and immediately show a calendar containing review, weak-spots, and practice-test sessions.

### Why judges may care

- Connects nearly every existing feature
- Demonstrates applied scheduling rather than generic AI text generation
- Produces an easy before-and-after story
- Has obvious real-world value

### Scope

**Medium.** A strong hackathon version can calculate plans locally without notifications or calendar integrations.

## 2. Misconception Detective

**Pitch:** “CardSparks does not only mark an answer wrong—it identifies why.”

After an incorrect answer, compare the prompt, correct answer, selected answer, and recent card history. Return a short likely misconception, one corrective explanation, and an optional follow-up card.

### Demo moment

Choose a believable wrong answer and show CardSparks identify the confused concepts rather than displaying a generic failure message.

### Why judges may care

- Creates a focused and defensible AI use case
- Extends the existing coaching architecture
- Makes the product feel like a tutor instead of a flashcard database

### Scope

**Medium.** Keep it optional and never block or alter scheduling.

## 3. Shareable Study Result

**Pitch:** “Turn a completed session into a polished progress card.”

Generate a privacy-safe result card showing score, streak, improvement, cards mastered, and next goal. Users can download it as an image or share a link.

### Demo moment

Complete a practice test and instantly produce an attractive “92% · 12-card streak · Biology ready” result.

### Why judges may care

- Delivers a visual payoff at the end of the demo
- Makes screenshots and the Devpost gallery stronger
- Small enough to polish thoroughly

### Scope

**Small.** Do not include card contents or personal information by default.

## 4. Ten-Minute Study Rescue

**Pitch:** “I have ten minutes—give me the highest-value session.”

The learner chooses a time budget. CardSparks selects the best mix of overdue, weak, and soon-due cards across decks, then explains why those cards were chosen.

### Demo moment

Move a time slider from 5 to 20 minutes and watch the session composition adapt.

### Why judges may care

- Easy to understand immediately
- Builds directly on weak-spots and Today data
- Demonstrates meaningful prioritization

### Scope

**Small to medium.** This can become the first slice of the Exam Countdown Planner.

## 5. Source-Cited Notes Tutor

**Pitch:** “Ask questions about your own notes and see exactly where the answer came from.”

Preserve extracted note sections or page references, then allow grounded questions with citations to the original paragraph or PDF page.

### Demo moment

Ask a question about an imported handout, receive a concise answer, and click the citation to highlight the supporting source passage.

### Why judges may care

- Stronger grounding story than an unrestricted chatbot
- Combines document parsing, retrieval, citations, and generation
- Addresses hallucination concerns visibly

### Scope

**Large.** Only choose this if the event rewards retrieval or sponsor AI infrastructure and the team has time for source persistence.

## 6. Live Study Duel

**Pitch:** “Turn any shared deck into a real-time challenge.”

Two players join a room, answer the same deck questions, and see live scores, response times, and a final review.

### Demo moment

Two teammates join from separate phones and race through three questions on stage.

### Why judges may care

- Highly memorable live demonstration
- Makes sharing feel active rather than static
- Shows real-time backend engineering

### Scope

**Large and demo-risky.** Build only if real-time infrastructure is relevant to a judging category and network reliability is controlled.

## 7. Voice Study Mode

**Pitch:** “Study without touching the screen.”

Read prompts aloud, accept spoken answers, compare the transcript with the expected concept, and allow voice grading. Particularly useful for language learning and accessibility.

### Demo moment

Ask CardSparks to quiz a teammate aloud and score their spoken response.

### Why judges may care

- Immediate multimodal appeal
- Opens an accessibility and language-learning story
- Builds on the existing card model

### Scope

**Medium.** Use browser speech APIs for a hackathon prototype and provide a typed fallback.

## 8. Teacher Challenge Links

**Pitch:** “A teacher can turn one deck into a no-account classroom assessment.”

Create an expiring challenge link with a deadline, timer, shuffled questions, and anonymous result collection. Keep the original deck and student schedules private.

### Demo moment

Generate a QR code, let a judge open it, answer two questions, and show the aggregated class result.

### Why judges may care

- Clear classroom impact
- Extends sharing and test mode coherently
- Creates a strong multi-user narrative

### Scope

**Medium to large.** A hackathon version can use nicknames and aggregate scores without full classroom administration.

## 9. Visual Knowledge Map

**Pitch:** “See which concepts connect—and where understanding breaks.”

Group cards into concepts and render a graph where node color represents mastery and edges represent related ideas.

### Demo moment

Open a biology deck and watch the map highlight a weak “cellular respiration” branch connected to missed cards.

### Why judges may care

- Visually distinctive project-page asset
- Turns invisible scheduling data into an intuitive mental model
- Can connect directly to weak-spots practice

### Scope

**Medium.** Prefer deterministic keyword relationships for the prototype; use AI only to refine labels.

## 10. Offline Exam Pack

**Pitch:** “Your study plan still works on a bus, plane, or unreliable campus network.”

Install CardSparks as a PWA, cache selected decks, queue review events offline, and synchronize them when connectivity returns.

### Demo moment

Disable the network, complete a study session, restore connectivity, and show a successful synchronization.

### Why judges may care

- Demonstrates engineering maturity
- Supports learners with unreliable connectivity
- Makes the product feel closer to production

### Scope

**Medium.** Excellent for a reliability or accessibility category, but less visually exciting than the planner or knowledge map.

## Polish ideas with high hackathon value

These are not flagship features, but they can materially improve judging:

- Seed a polished demo account with believable review history.
- Add a guided first-run checklist that reaches the first study session quickly.
- Add empty, loading, offline, and AI-failure states to the demo script.
- Create a consistent set of project-page screenshots at desktop and mobile sizes.
- Add a privacy explainer showing which data is local, private, public, or sent to AI.
- Add a “Why this card?” explanation to adaptive queues.
- Add keyboard shortcuts and visible focus states for the live demo.
- Add one-click reset for mock/demo data.

## Ideas to avoid before submission

- A generic chatbot without citations or a connection to study history
- Large social feeds, comments, or follower systems
- Cosmetic gamification that rewards clicking rather than learning
- Full classroom administration before a simple challenge-link prototype works
- Native mobile applications when the responsive web demo is not yet polished
- Replacing stable mock-mode flows with live AI calls during the primary demo
- Any feature that silently modifies scheduling or learner-authored content

## Suggested build order if time is limited

### One short work session

1. Shareable Study Result
2. Demo-account reset
3. Screenshot and empty-state polish

### One full day

1. Ten-Minute Study Rescue
2. Misconception Detective
3. Shareable Study Result

### Multiple teammates with more than one day

1. Adaptive Exam Countdown Planner
2. Misconception Detective
3. Teacher Challenge Links or Visual Knowledge Map
4. Final reliability and presentation pass

