# F3 — Acceptance of natural character voices

**Current status:** Technical integration exists. Real commercial speech quality is **NOT VERIFIED**. A successful WAV render is not evidence of natural delivery, humor, or localization quality.

## Preconditions
- Choose an HTTPS or loopback OpenAI-compatible TTS endpoint and a model whose commercial use permits this workload.
- Configure `ANYMOTION_TTS_ENDPOINT`, `ANYMOTION_TTS_MODEL`, `ANYMOTION_TTS_VOICES` (map for es-ES/en-US and vera/leo), and if needed `ANYMOTION_TTS_API_KEY`. Never commit keys.
- Verify the provider has explicit permission for the selected voices. No real-person voice cloning without consent.
- Check actual price and voice availability before running. The audition calls the provider **eight times** and may incur charges.

## Reproducible audition

```sh
npm install
npm test
npm run audition:voices -- --confirm I_ACCEPT_TTS_COSTS
```

The command writes eight WAV samples (two delivery styles per actor and language), together with a `workspace/auditions/<provider-fingerprint>/audition.json` containing SHA-256 hashes, measured duration, sample rate, channels and codec. It uses `ffprobe`, a staging directory and no-overwrite semantics. A failed sample leaves no accepted receipt. A second run with the same provider ID refuses to overwrite evidence.

This command **never** marks a voice approved. Verify every generated clip for intelligibility, pronunciation, stable character identity, sarcasm, surprise, timing, artifacts, cultural adaptation, and appropriate rights. Log a concrete human decision separately. For a material model/voice change, create a new provider fingerprint; do not delete the only historical evidence.

## Required additional verification
1. A native speaker listens to es-ES and en-US clips and a full story scene.
2. A full 8–10 minute episode is mixed and checked for missing/truncated speech and consistent voice identity.
3. Windows (target hardware) passes the same media checks with the exact TTS and FFmpeg versions.
4. Written rights/voice license attestation and human editorial approval are linked to the final release hashes.

A passing audition only means the provider returned technically valid speech-shaped WAV files. It **does not** unblock commercial publication by itself.
