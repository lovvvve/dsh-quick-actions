# Identify Durable Configuration and Preset Seams

Type: research
Mode: AFK
Status: resolved
Blocked by: 01

## Question

Which exact DSH/Cordis Host and Client facilities can persist user-owned Quick Actions across local DSH restarts and accept author-owned Preset Quick Actions from an installable package? Determine the supported configuration or storage APIs, Client-to-Host boundary, lifecycle constraints, stable identity expectations, and schema-migration facilities, with exact contracts and source references.

## Answer

The cited research asset is [Durable Configuration and Preset Seams for Quick Actions](../research/durable-configuration-seams.md), captured on branch `research/durable-configuration-seams` at commit `07e0b85`.

Use the Host `settings` service backed by `@deepseek-ai/dsh-settings-file`. Keep author-owned Preset Quick Actions immutable in package code or Host composition config, and persist only ID-keyed user actions, explicit user ordering, and per-preset deltas in one stable lowercase-hyphen namespace. The Client edits the Host-authoritative namespace through `settingsScope` and generated `remote.settings` calls with revision fencing; browser-local persistence is not a supported authority.

`storageDomain` is a supported but heavier Host-only alternative requiring a configured backend, explicit `Domain.close()` lifecycle ownership, and a custom Client controller. It adds record-scale point writes but still has no data migration. Settings likewise has no pre-validation schema migration hook, so the first release should use a backward-readable versioned schema followed by an idempotent revision-fenced canonical rewrite; a strict future migration facility would require a DSH core extension.
