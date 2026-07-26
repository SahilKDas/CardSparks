# Instructions for coding agents

Before editing this repository:

1. Read [`CONTEXT.md`](CONTEXT.md) completely.
2. Read the relevant section of [`README.md`](README.md).
3. Run `git status` and preserve teammate work.
4. Run `npm run test:all` before and after substantial changes.

Project guardrails:

- Keep the no-key and `SIDEKICK_OFFLINE=1` paths functional.
- Never present demo or curated data as live.
- Route all AI output through the shared recommendation normalizer.
- Do not commit `.env`, API keys, SQLite databases, build output, or dependencies.
- Do not add paid requirements or expand hackathon scope without explicit approval.
- Update tests and documentation when changing an API or the recorded demo path.

The product owner is non-technical. Own implementation and debugging within the requested scope; ask only for credentials or genuine product decisions.
