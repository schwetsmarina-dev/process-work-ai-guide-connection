import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Text-to-speech for a ProcessPractice, using ElevenLabs voice cloning.
// The function is deliberately fail-soft: the text practice remains usable
// even when TTS is unavailable, but audio generation itself is protected by
// authentication + ownership checks because it consumes a paid external API.
//
// Required secrets (Base44 → Settings → Secrets):
//   ELEVENLABS_API_KEY
//   ELEVENLABS_VOICE_ID

const MAX_TTS_CHARS = 4500;
const TTS_TIMEOUT_MS = 45_000;

async function markFailed(base44, practiceId, error) {
  await base44.asServiceRole.entities.ProcessPractice.update(practiceId, {
    audio_status: 'failed',
    audio_error: String(error).slice(0, 500),
  }).catch(() => null);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const practiceId = body.practice_id;
    if (!practiceId) return Response.json({ error: 'Missing practice_id' }, { status: 400 });

    const practice = await base44.asServiceRole.entities.ProcessPractice.get(practiceId).catch(() => null);
    if (!practice) return Response.json({ error: 'Practice not found' }, { status: 404 });

    // Service-role lookup is needed for the server function, so enforce the
    // equivalent ownership rule explicitly. Admin may regenerate test audio;
    // normal users may only generate audio for their own practice.
    if (caller.role !== 'admin' && practice.user_id !== caller.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Idempotency/cost guard: don't spend ElevenLabs credits again when a
    // completed audio file already exists unless the caller explicitly asks.
    if (practice.audio_status === 'ready' && practice.audio_url && !body.force_regenerate) {
      return Response.json({ ok: true, audio_url: practice.audio_url, reused: true });
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID');

    if (!apiKey || !voiceId) {
      await markFailed(
        base44,
        practiceId,
        'missing_secret: set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in Base44 → Settings → Secrets',
      );
      return Response.json({ ok: false, reason: 'missing_secret' });
    }

    const text = String(practice.full_text || '').trim();
    if (!text) {
      await markFailed(base44, practiceId, 'empty_text');
      return Response.json({ ok: false, reason: 'empty_text' });
    }

    // Never silently cut the ending off a psychological practice. If a future
    // script grows beyond the cost/latency guard, fail visibly so it can be
    // shortened or proper chunked TTS can be implemented.
    if (text.length > MAX_TTS_CHARS) {
      await markFailed(base44, practiceId, `text_too_long:${text.length}>${MAX_TTS_CHARS}`);
      return Response.json({ ok: false, reason: 'text_too_long', chars: text.length, limit: MAX_TTS_CHARS });
    }

    await base44.asServiceRole.entities.ProcessPractice.update(practiceId, {
      audio_status: 'generating',
      audio_error: '',
    });

    let audioBuffer;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
      let ttsRes;
      try {
        ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.16,
              similarity_boost: 0.87,
              style: 0.70,
              speed: 0.90,
              use_speaker_boost: true,
            },
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!ttsRes.ok) {
        const errText = await ttsRes.text().catch(() => '');
        throw new Error(`ElevenLabs ${ttsRes.status}: ${errText.slice(0, 300)}`);
      }

      const contentType = ttsRes.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('audio')) {
        throw new Error(`ElevenLabs returned unexpected content-type: ${contentType || 'missing'}`);
      }

      audioBuffer = await ttsRes.arrayBuffer();
      if (!audioBuffer.byteLength) throw new Error('ElevenLabs returned empty audio');
    } catch (e) {
      const message = e?.name === 'AbortError'
        ? `ElevenLabs request timed out after ${TTS_TIMEOUT_MS}ms`
        : (e?.message || 'unknown');
      console.error('[generatePracticeAudio] TTS call failed:', message);
      await markFailed(base44, practiceId, `tts_call_failed: ${message}`);
      return Response.json({ ok: false, reason: 'tts_call_failed', error: message });
    }

    try {
      const file = new File([audioBuffer], `process-practice-${practiceId}.mp3`, { type: 'audio/mpeg' });
      const upload = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      const fileUrl = upload?.file_url;
      if (!fileUrl) throw new Error('UploadFile returned no file_url');

      await base44.asServiceRole.entities.ProcessPractice.update(practiceId, {
        audio_status: 'ready',
        audio_url: fileUrl,
        voice_id: voiceId,
        audio_error: '',
      });

      console.log('[generatePracticeAudio] ready for practice', practiceId);
      return Response.json({ ok: true, audio_url: fileUrl, reused: false });
    } catch (e) {
      const message = e?.message || 'unknown';
      console.error('[generatePracticeAudio] upload failed:', message);
      await markFailed(base44, practiceId, `upload_failed: ${message}`);
      return Response.json({ ok: false, reason: 'upload_failed', error: message });
    }
  } catch (error) {
    console.error('[generatePracticeAudio] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});
