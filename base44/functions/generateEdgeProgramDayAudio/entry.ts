import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';

const MAX_CHARS_PER_CHUNK = 3400;
const MAX_TOTAL_CHARS = 10000;
const TTS_TIMEOUT_MS = 45_000;

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function splitText(text: string) {
  const paragraphs = String(text || '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_CHARS_PER_CHUNK) {
      const sentences = paragraph.split(/(?<=[.!?…])\s+/);
      for (const sentence of sentences) {
        if ((current + ' ' + sentence).trim().length > MAX_CHARS_PER_CHUNK && current) {
          chunks.push(current.trim()); current = '';
        }
        current = `${current} ${sentence}`.trim();
      }
      continue;
    }
    if ((current + '\n\n' + paragraph).trim().length > MAX_CHARS_PER_CHUNK && current) {
      chunks.push(current.trim()); current = paragraph;
    } else current = `${current}\n\n${paragraph}`.trim();
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

async function markFailed(base44: any, dayId: string, message: string) {
  await base44.asServiceRole.entities.EdgeProgramDay.update(dayId, {
    audio_status: 'failed',
    audio_error: message.slice(0, 500),
  }).catch(() => null);
}

async function synthesize(apiKey: string, voiceId: string, text: string, languageCode: 'ru' | 'es') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST', signal: controller.signal,
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_v3',
        language_code: languageCode,
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('audio')) throw new Error(`unexpected_content_type:${contentType}`);
    const buffer = await res.arrayBuffer();
    if (!buffer.byteLength) throw new Error('empty_audio');
    return new Uint8Array(buffer);
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const entitlementRes = await base44.functions.invoke('getEntitlement', {}).catch(() => null);
    const entitlement = entitlementRes?.data || entitlementRes;
    if (caller.role !== 'admin' && !entitlement?.hasAccess) return Response.json({ error: 'feature_requires_full_access' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dayId = clean(body.day_id);
    const programId = clean(body.program_id);
    let day: any = null;
    let ephemeral = false;

    if (dayId) {
      day = await base44.asServiceRole.entities.EdgeProgramDay.get(dayId).catch(() => null);
      if (!day || String(day.user_id) !== String(caller.id)) return Response.json({ error: 'Day not found' }, { status: 404 });
      if (day.audio_status === 'ready' && day.audio_url && body.force_regenerate !== true) {
        return Response.json({ ok: true, audio_url: day.audio_url, reused: true });
      }
    } else {
      if (!programId) return Response.json({ error: 'day_id_or_program_id_required' }, { status: 400 });
      const program = await base44.asServiceRole.entities.EdgeProgram.get(programId).catch(() => null);
      if (!program || String(program.user_id) !== String(caller.id)) return Response.json({ error: 'Program not found' }, { status: 404 });
      ephemeral = true;
    }

    let languageCode: 'ru' | 'es' = 'es';
    try {
      const appUsers = caller.email ? await base44.asServiceRole.entities.AppUser.filter({ email: caller.email }) : [];
      if (appUsers[0]?.language === 'ru') languageCode = 'ru';
    } catch {}

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID');
    if (!apiKey || !voiceId) {
      if (dayId) await markFailed(base44, dayId, 'missing_secret');
      return Response.json({ ok: false, reason: 'missing_secret' });
    }

    const text = String(ephemeral ? body.practice_text : day.practice_text || '').trim();
    if (!text) {
      if (dayId) await markFailed(base44, dayId, 'empty_text');
      return Response.json({ ok: false, reason: 'empty_text' });
    }
    if (text.length > MAX_TOTAL_CHARS) {
      if (dayId) await markFailed(base44, dayId, `text_too_long:${text.length}`);
      return Response.json({ ok: false, reason: 'text_too_long', chars: text.length, limit: MAX_TOTAL_CHARS });
    }

    if (dayId) await base44.asServiceRole.entities.EdgeProgramDay.update(dayId, { audio_status: 'generating', audio_error: '' });

    try {
      const chunks = splitText(text);
      const buffers: Uint8Array[] = [];
      for (const chunk of chunks) buffers.push(await synthesize(apiKey, voiceId, chunk, languageCode));
      const total = buffers.reduce((n, b) => n + b.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const b of buffers) { merged.set(b, offset); offset += b.byteLength; }
      const file = new File([merged], `edge-program-${dayId || clean(body.support_event_id) || crypto.randomUUID()}.mp3`, { type: 'audio/mpeg' });
      const upload = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      const audioUrl = upload?.file_url;
      if (!audioUrl) throw new Error('upload_no_url');
      if (dayId) {
        await base44.asServiceRole.entities.EdgeProgramDay.update(dayId, {
          audio_status: 'ready', audio_url: audioUrl, voice_id: voiceId, audio_error: '',
        });
      }
      return Response.json({ ok: true, audio_url: audioUrl, reused: false, ephemeral, chunks: chunks.length });
    } catch (e) {
      const message = e?.name === 'AbortError' ? 'tts_timeout' : (e?.message || 'audio_failed');
      if (dayId) await markFailed(base44, dayId, message);
      return Response.json({ ok: false, reason: 'audio_failed', error: message });
    }
  } catch (error) {
    console.error('[generateEdgeProgramDayAudio] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});