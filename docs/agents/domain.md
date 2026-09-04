# Domain Docs

This repository uses a single domain context.

## Before exploring, read these

- `CONTEXT.md` at the repository root
- Relevant ADRs under `docs/adr/`

If they do not exist, proceed silently. The domain-modeling skill creates them lazily when vocabulary or durable decisions emerge.

## Layout

/
├── CONTEXT.md
├── docs/adr/
└── src/

Use vocabulary defined in `CONTEXT.md`. If work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding it.
