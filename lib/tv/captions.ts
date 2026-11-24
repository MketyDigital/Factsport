/**
 * Deterministic WebVTT packaging for human-authored TV narration.
 * This module does not create narration or infer dialogue from match events.
 */
export type NarrationCaption = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  factIds: string[];
};

export type CaptionEvidence = {
  id: string;
  verified: boolean;
};

export type CaptionPackage = {
  vtt: string;
  provenance: Array<{ cueId: string; factIds: string[] }>;
  durationMs: number;
};

const CUE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_CAPTION_CHARS = 240;

function timestamp(milliseconds: number): string {
  const ms = Math.floor(milliseconds % 1000);
  const totalSeconds = Math.floor(milliseconds / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function safeCaptionText(value: string): string {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || text.length > MAX_CAPTION_CHARS) throw new Error('tv_caption_text_invalid');
  // Keep VTT payloads plain text; prevent cue injection, markup and hidden controls.
  if (/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text) || /-->/u.test(text)) {
    throw new Error('tv_caption_text_unsafe');
  }
  return text;
}

/**
 * Package approved narration lines as WebVTT while retaining their evidence map.
 * Every cue must cite at least one verified fact from the frozen episode snapshot.
 */
export function buildNarrationCaptionPackage(
  captions: NarrationCaption[],
  evidence: CaptionEvidence[],
  durationMs: number,
): CaptionPackage {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) throw new Error('tv_caption_duration_invalid');
  if (!Array.isArray(captions) || captions.length === 0) throw new Error('tv_caption_cues_missing');

  const verifiedIds = new Set(evidence.filter((fact) => fact.verified).map((fact) => fact.id));
  const seenIds = new Set<string>();
  let previousEnd = 0;
  const provenance: CaptionPackage['provenance'] = [];
  const blocks = captions.map((cue) => {
    if (!cue || !CUE_ID.test(cue.id) || seenIds.has(cue.id)) throw new Error('tv_caption_id_invalid');
    seenIds.add(cue.id);
    if (!Number.isSafeInteger(cue.startMs) || !Number.isSafeInteger(cue.endMs) ||
        cue.startMs < 0 || cue.endMs <= cue.startMs || cue.endMs > durationMs || cue.startMs < previousEnd) {
      throw new Error('tv_caption_timing_invalid');
    }
    if (!Array.isArray(cue.factIds) || cue.factIds.length === 0 || cue.factIds.some((id) => !verifiedIds.has(id))) {
      throw new Error('tv_caption_evidence_missing');
    }
    const body = safeCaptionText(cue.text);
    previousEnd = cue.endMs;
    provenance.push({ cueId: cue.id, factIds: [...new Set(cue.factIds)] });
    return `${cue.id}\n${timestamp(cue.startMs)} --> ${timestamp(cue.endMs)}\n${body}`;
  });

  return {
    vtt: `WEBVTT\n\n${blocks.join('\n\n')}\n`,
    provenance,
    durationMs,
  };
}
