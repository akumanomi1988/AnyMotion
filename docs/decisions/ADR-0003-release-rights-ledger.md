# ADR-0003 — Release-bound rights and provenance attestation

**Status:** Implemented as a technical publication gate, legal ownership unverified. **Date:** 2026-11-11.

## Problem

The prior editorial approval accepted a boolean `commercialRightsConfirmed` without recording which release inputs were claimed as owned/licensed. That allowed a later unrelated rights record to be substituted without a cryptographic link to the editorial decision.

## Decision

- Build an inventory from the **verified final release**, never from a model or arbitrary supplied paths. It covers the picture master, each localized voice manifest, and music/SFX files when present.
- Require a human to provide one evidence-bearing `RightsClaim` for each inventoried material: exact `assetId`, `sha256`, rights holder, `original-owned` or `licensed-commercial`, specific explanatory evidence and, for third-party material, a commercial license reference.
- Write `productions/<episodeId>/rights-attestation.json` once (`wx`), bound to the release's SHA-256 and all material hashes. Do not invent or autoapprove claims. Invalid or incomplete claims fail closed.
- `editorial-approve` requires a valid attestation; its immutable decision now includes `rightsEvidenceSha256`. All publication flows call `verifyEditorialApproval` and therefore recheck the rights attestation.
- Changing a source, dubbing manifest, sound stem, release or attestation invalidates the previous approval. Revisions must be explicit; files are never overwritten in place.

## Important limitations

A signed-off attestation is **a record of a human assertion**, not independently authenticated proof of ownership, a legal opinion or a license validator. Reviewers must inspect the underlying licenses, original creation records, terms of AI models/providers and the intended commercial uses. Commercial voices also require the separate allowlist and voice quality checks. The code does not attempt to approve copyrighted samples automatically.

The visual material is currently tracked at master-video granularity. If new external assets, fonts or samples are introduced, the inventory needs additional categories and source-level references before release; do not mistake a render hash for a full asset chain of custody.

## Reversal condition

Replace the ledger with a richer source-asset registry only if it preserves verified final-release binding, complete material coverage, immutable editorial decisions and explicit human authorization. Do not drop the rights gate to increase production throughput.
