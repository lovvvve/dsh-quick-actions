# Identify Supported DSH Composer Extension Seams

Type: research
Mode: AFK
Status: resolved
Blocked by: 01

## Question

Which exact supported DSH/Cordis package mechanism, Client Slots, Services, Events, and Builtins can a persistent plugin use to render controls above or below every message composer, preserve lifecycle cleanup, insert static text at the current selection, and submit a message through the same official path as the composer? Record exact contracts and source references, and identify any required DSH core extension if no supported seam exists.

## Answer

The cited research asset is [Supported DSH Composer Extension Seams](../research/composer-extension-seams.md), captured on branch `research/composer-extension-seams` at commit `5847e14`.

A persistent extension is supported as a web-profile bundle whose patch inserts a built `dsh.client` package. Additive `conversation.input.dock` and `conversation.composer.dock` Slots cover the normal session-backed resident composer; their Slot registrations and ordinary Cordis effects clean up with their owning fiber. Slot-standard `inputActions.submit()` follows the shipped composer submission path.

Two required behaviors are not public in DSH `0.1.2-rc.1`: selection-aware text insertion and one additive placement seam spanning no-session, hero, resident, and takeover composers. `setDraft(text)` replaces the whole draft and moves the caret to the end, while the existing selection-aware `paste(text)` path is private. The smallest insertion prerequisite is a public `inputActions.insertText(text)` delegating to that path; literal all-composer placement would additionally need an outer additive Slot. The product/core boundary is delegated to [Choose the Required DSH Composer Core Extensions](./09-choose-required-dsh-composer-core-extensions.md).
