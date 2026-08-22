import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';

const MAX_TOTAL_CHARS = 9000;
const MAX_CHARS_PER_CHUNK = 2800;
const TTS_TIMEOUT_MS = 45_000;

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function splitText(text: string) {
  const sentences = String(text || '').trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > MAX_CHARS_PER_CHUNK && current) {
      chunks.push(current.trim());
      current = '';
    }
    if (sentence.length > MAX_CHARS_PER_CHUNK) {
      if (current) { chunks.push(current.trim()); current = ''; }
      for (let i = 0; i < sentence.length; i += MAX_CHARS_PER_CHUNK) chunks.push(sentence.slice(i, i + MAX_CHARS_PER_CHUNK));
    } else current = `${current} ${sentence}`.trim();
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

async function synthesize(apiKey: string, voiceId: string, text: string, lang: 'ru' | 'es') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST', signal: controller.signal,
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_v3', language_code: lang }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('audio')) throw new Error(`unexpected_content_type:${contentType}`);
    const buffer = new Uint8Array(await res.arrayBuffer());
    if (!buffer.byteLength) throw new Error('empty_audio');
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

function hasNamedAuthor(value: unknown) {
  const s = clean(value);
  if (!s) return false;
  const genericOnly = /^(process work учебная практика|ispwr training materials|ispwr\s*\/\s*сертификационные материалы|ispwr\s*\/\s*talvira adaptation|talvira methodology synthesis|ispwr trauma\/resource materials\s*\/\s*talvira adaptation)$/i;
  return !genericOnly.test(s);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const entitlementRes = await base44.functions.invoke('getEntitlement', {}).catch(() => null);
    const entitlement = entitlementRes?.data || entitlementRes;
    if (caller.role !== 'admin' && !entitlement?.hasAccess) {
      return Response.json({ error: 'feature_requires_full_access' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const exerciseId = clean(body.exercise_id);
    if (!exerciseId) return Response.json({ error: 'exercise_id_required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.ProcessExercise.filter({ exercise_id: exerciseId }, 'exercise_id', 2).catch(() => []);
    const exercise = rows[0] || null;
    if (!exercise || exercise.active === false) return Response.json({ error: 'Exercise not found' }, { status: 404 });
    if (!hasNamedAuthor(exercise.author) || exercise.requires_live_facilitator === true || exercise.delivery_level === 'live_specialist' || exercise.intensity === 'high') {
      return Response.json({ error: 'exercise_not_client_playable' }, { status: 403 });
    }

    let lang = 'es';
    try {
      const appUsers = caller.email ? await base44.asServiceRole.entities.AppUser.filter({ email: caller.email }) : [];
      if (['ru', 'es'].includes(appUsers[0]?.language)) lang = appUsers[0].language;
    } catch {}

    const title = lang === 'es' ? clean(exercise.title_es) : clean(exercise.title_ru);
    const purpose = lang === 'es' ? clean(exercise.purpose_es) : clean(exercise.purpose);
    const steps = lang === 'es' ? (Array.isArray(exercise.steps_es) ? exercise.steps_es : []) : (Array.isArray(exercise.steps) ? exercise.steps : []);

    if (!title || !purpose || !steps.length || steps.some((x: unknown) => !clean(x))) {
      return Response.json({ ok: false, reason: lang === 'es' ? 'spanish_localization_incomplete' : 'exercise_text_incomplete' });
    }

    const intro = lang === 'es' ? `${title}. ${purpose}` : `${title}. ${purpose}`;
    const numbered = steps.map((step: unknown, index: number) => lang === 'es' ? `Paso ${index + 1}. ${clean(step)}` : `Шаг ${index + 1}. ${clean(step)}`);
    const text = [intro, ...numbered].join('\n\n').trim();
    if (text.length > MAX_TOTAL_CHARS) return Response.json({ ok: false, reason: 'text_too_long' });

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID');
    if (!apiKey || !voiceId) return Response.json({ ok: false, reason: 'missing_secret' });

    const chunks = splitText(text);
    const buffers: Uint8Array[] = [];
    for (const chunk of chunks) buffers.push(await synthesize(apiKey, voiceId, chunk, lang as 'ru' | 'es'));
    const total = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const buffer of buffers) { merged.set(buffer, offset); offset += buffer.byteLength; }

    const file = new File([merged], `exercise-${exerciseId}-${lang}.mp3`, { type: 'audio/mpeg' });
    const upload = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const audioUrl = upload?.file_url;
    if (!audioUrl) throw new Error('upload_no_url');

    return Response.json({ ok: true, audio_url: audioUrl, language: lang, model_id: 'eleven_v3' });
  } catch (error) {
    console.error('[generateExerciseAudio] fatal:', error?.message, String(error));
    return Response.json({ ok: false, reason: error?.name === 'AbortError' ? 'tts_timeout' : 'audio_failed', error: error?.message || 'Internal error' }, { status: 500 });
  }
});
