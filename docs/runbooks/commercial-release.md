# AnyMotion — manual commercial-release runbook

**No automatic approval or publication.** A green CI, a preview video, and a rights check do not establish narrative quality or legal ownership.

1. Generate and inspect a final 8–10 minute episode with verified H.264/AAC, timed dialogue and character-specific SRTs. Review story quality and all localization work with people, not just models.
2. Run `node dist/cli.js editorial-analyze <episode.json>` and resolve the findings with a human editor.
3. Run `node dist/cli.js rights-inventory <episode.json>` **after** final package verification. Investigate the video master, each locale voice, music and effects; collect the relevant original work records and third-party licenses.
4. Prepare `workspace/claims.json` containing an explicit claim for every inventoried `assetId` and exact `sha256`, `rightsHolder`, `basis` (`original-owned` or `licensed-commercial`) and specific `evidence`. Third-party materials require a `licenseReference`. Never auto-generate ownership assertions.
5. Prepare detailed human rights review notes, then run:
   `node dist/cli.js rights-attest <episode.json> --claims-file workspace/claims.json --reviewer "Producer" --notes-file workspace/rights-review.txt --confirm ATTEST_RIGHTS:EPID`
   Verify the immutable attestation with `rights-check`.
6. Audition each final voice and configure its reviewed commercial profile in `ANYMOTION_APPROVED_VOICE_PROVIDERS`. Diagnostic eSpeak and synthetic voices must not be published.
7. Review the completed final episode, visuals, music, captions, thumbnail and channel classification. Record detailed editorial notes and execute `editorial-approve` with explicit `APPROVE:EPID` confirmation.
8. Use `youtube-kit` for manual language audio and captions. If OAuth is authorized, use `youtube-private` only with its explicit confirmation and verify remote **private** status before any separate scheduling action.
9. Preserve an independent hash-verified backup, YouTube identifiers and rights receipts. The pilot requires six genuinely original published episodes and **observed** analytics before scaling.

The rights ledger records a **human claim** bound to release bytes; it cannot independently authenticate ownership or predict YouTube monetization. Stale rights or modified media invalidate earlier editorial approval.