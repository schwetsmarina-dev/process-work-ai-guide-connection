import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Text-to-speech for a ProcessPractice, using ElevenLabs voice cloning
// (the app owner's own recorded voice sample). Base44 has no built-in TTS,
// so this calls ElevenLabs directly with a fetch and stores the result via
// UploadFile. Fails soft: audio_status='failed' + audio_error, never throws
// into the caller — text is always usable even if audio isn't configured yet.
//
// Required secrets (set in Base44 dashboard → Settings → Secrets):
//   ELEVENLABS_API_KEY  — API key from elevenlabs.io
//   ELEVENLABS_VOICE_ID — voice_id of the cloned voice (Instant Voice Cloning)

const MAX_TTS_CHARS = 4500; // keep cost/latency bounded; practices are short by design

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const practiceId = body.practice_id;
    if (!practiceId) return Response.json({ error: 'Missing practice_id' }, { status: 400 });

    const practice = await base44.asServiceRole.entities.ProcessPractice.get(practiceId).catch(() => null);
    if (!practice) return Response.json({ error: 'Practice not found' }, { status: 404 });

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID');

    if (!apiKey || !voiceId) {
      await base44.asServiceRole.entities.ProcessPractice.update(practiceId, {
        audio_status: 'failed',
        audio_error: 'missing_secret: set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in Base44 → Settings → Secrets',
      });
      return Response.json({ ok: false, reason: 'missing_secret' });
    }

    await base44.asServiceRole.entities.ProcessPractice.update(practiceId, { audio_status: 'generating' });

    const text = String(practice.full_text || '').slice(0, MAX_TTS_CHARS);
    if (!text.trim()) {
      await base44.asServiceRole.entities.ProcessPractice.update(practiceId, {
        audio_status: 'failed',
        audio_error: 'empty_text',
      });
      return Response.json({ ok: false, reason: 'empty_text' });
    }

    let audioBuffer;
    try {
      const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2', // supports ru/es/en from one cloned voice
          // Tuned by the voice owner in the ElevenLabs UI for this specific cloned
          // voice ("Amplification") to sound maximally like her own speaking voice.
          voice_settings: { stability: 0.16, similarity_boost: 0.87, style: 0.70, speed: 0.90, use_speaker_boost: true },
        }),
      });
      if (!ttsRes.ok) {
        const errText = await ttsRes.text().catch(() => '');
        throw new Error(`ElevenLabs ${ttsRes.status}: ${errText.slice(0, 300)}`);
      }
      audioBuffer = await ttsRes.arrayBuffer();
    } catch (e) {
      console.error('[generatePracticeAudio] TTS call failed:', e?.message);
      await base44.asServiceRole.entities.ProcessPractice.update(practiceId, {
        audio_status: 'failed',
        audio_error: `tts_call_failed: ${e?.message || 'unknown'}`,
      });
      return Response.json({ ok: false, reason: 'tts_call_failed', error: e?.message });
    }

    try {
      const file = new File([audioBuffer], `process-practice-${practiceId}.mp3`, { type: 'audio/mpeg' });
      const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

      await base44.asServiceRole.entities.ProcessPractice.update(practiceId, {
        audio_status: 'ready',
        audio_url: file_url,
        voice_id: voiceId,
        audio_error: '',
      });

      console.log('[generatePracticeAudio] ready for practice', practiceId);
      return Response.json({ ok: true, audio_url: file_url });
    } catch (e) {
      console.error('[generatePracticeAudio] upload failed:', e?.message);
      await base44.asServiceRole.entities.ProcessPractice.update(practiceId, {
        audio_status: 'failed',
        audio_error: `upload_failed: ${e?.message || 'unknown'}`,
      });
      return Response.json({ ok: false, reason: 'upload_failed', error: e?.message });
    }
  } catch (error) {
    console.error('[generatePracticeAudio] fatal:', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});
