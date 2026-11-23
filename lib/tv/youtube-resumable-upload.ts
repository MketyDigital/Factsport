import 'server-only';

/** Server-only YouTube Data API resumable upload primitives for TV jobs. */
const API_ORIGIN = 'https://www.googleapis.com';
const UPLOAD_ENDPOINT = `${API_ORIGIN}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`;
const SESSION_URL = /^https:\/\/www\.googleapis\.com\/upload\/youtube\/v3\/videos\?/i;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const CHUNK_UNIT_BYTES = 256 * 1024;

export type YouTubeUploadMetadata = {
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  containsSyntheticMedia: boolean;
};

export type YouTubeUploadSession = {
  sessionUrl: string;
  expectedBytes: number;
  contentType: string;
};

/** Obtain a short-lived access token using a server-held refresh token. */
export async function refreshYouTubeAccessToken(credentials: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) throw new Error('youtube_oauth_credentials_missing');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new Error(`youtube_oauth_refresh_failed_${response.status}`);
  const result = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof result.access_token !== 'string' || !Number.isSafeInteger(result.expires_in)) throw new Error('youtube_oauth_token_response_invalid');
  return { accessToken: result.access_token, expiresIn: result.expires_in as number };
}

export async function startYouTubePrivateUpload(input: {
  accessToken: string;
  metadata: YouTubeUploadMetadata;
  expectedBytes: number;
  contentType: string;
}): Promise<YouTubeUploadSession> {
  if (!input.accessToken.trim()) throw new Error('youtube_oauth_token_missing');
  if (!Number.isSafeInteger(input.expectedBytes) || input.expectedBytes < 1) throw new Error('youtube_video_size_invalid');
  if (!/^video\/(mp4|webm|quicktime)$/i.test(input.contentType)) throw new Error('youtube_video_type_invalid');
  if (!input.metadata.title.trim() || input.metadata.title.length > 100 || !input.metadata.description.trim()) throw new Error('youtube_metadata_invalid');

  const response = await fetch(UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(input.expectedBytes),
      'X-Upload-Content-Type': input.contentType,
    },
    body: JSON.stringify({
      snippet: {
        title: input.metadata.title.trim(),
        description: input.metadata.description.trim(),
        tags: (input.metadata.tags || []).slice(0, 30),
        categoryId: input.metadata.categoryId || '17',
      },
      // Upload as private first. A separate human review step changes visibility.
      status: {
        privacyStatus: 'private',
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: input.metadata.containsSyntheticMedia,
      },
    }),
  });
  const sessionUrl = response.headers.get('location') || '';
  if (!response.ok || !SESSION_URL.test(sessionUrl)) throw new Error(`youtube_upload_session_failed_${response.status}`);
  return { sessionUrl, expectedBytes: input.expectedBytes, contentType: input.contentType };
}

export async function sendYouTubeUploadChunk(input: {
  session: YouTubeUploadSession;
  bytes: Uint8Array;
  start: number;
  endInclusive: number;
}): Promise<{ state: 'incomplete' | 'uploaded'; nextOffset?: number; videoId?: string }> {
  const { session, bytes, start, endInclusive } = input;
  if (!SESSION_URL.test(session.sessionUrl)) throw new Error('youtube_upload_session_invalid');
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_CHUNK_BYTES) throw new Error('youtube_upload_chunk_size_invalid');
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(endInclusive) || start < 0 || endInclusive < start || endInclusive - start + 1 !== bytes.byteLength || endInclusive >= session.expectedBytes) throw new Error('youtube_upload_range_invalid');
  const isFinal = endInclusive + 1 === session.expectedBytes;
  if (!isFinal && bytes.byteLength % CHUNK_UNIT_BYTES !== 0) throw new Error('youtube_upload_chunk_alignment_invalid');

  const response = await fetch(session.sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': session.contentType,
      'Content-Length': String(bytes.byteLength),
      'Content-Range': `bytes ${start}-${endInclusive}/${session.expectedBytes}`,
    },
    body: bytes as BodyInit,
  });
  if (response.status === 308) {
    const range = response.headers.get('range') || '';
    const receivedEnd = Number(range.match(/bytes=0-(\d+)/i)?.[1]);
    if (!Number.isSafeInteger(receivedEnd) || receivedEnd < 0 || receivedEnd >= session.expectedBytes) throw new Error('youtube_upload_resume_offset_invalid');
    return { state: 'incomplete', nextOffset: receivedEnd + 1 };
  }
  if (response.status !== 201) throw new Error(`youtube_upload_chunk_failed_${response.status}`);
  const result = await response.json() as { id?: unknown };
  if (typeof result.id !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(result.id)) throw new Error('youtube_upload_video_id_missing');
  return { state: 'uploaded', videoId: result.id };
}
