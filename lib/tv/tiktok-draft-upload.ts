import 'server-only';

/** Upload a video to the creator's TikTok inbox as a draft; it is not posted. */
const INBOX_UPLOAD_ENDPOINT = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';

export async function createTikTokInboxDraft(input: {
  accessToken: string;
  videoUrl: string;
  consentToUpload: boolean;
  rightsCleared: boolean;
  humanApproved: boolean;
}): Promise<{ publishId: string; state: 'awaiting_creator_review' }> {
  if (!input.consentToUpload) throw new Error('tiktok_upload_consent_required');
  if (!input.rightsCleared) throw new Error('tiktok_content_rights_not_cleared');
  if (!input.humanApproved) throw new Error('tiktok_episode_review_required');
  if (!input.accessToken.trim()) throw new Error('tiktok_creator_authorization_missing');
  let videoUrl: URL;
  try {
    videoUrl = new URL(input.videoUrl);
  } catch {
    throw new Error('tiktok_video_url_invalid');
  }
  if (videoUrl.protocol !== 'https:' || videoUrl.hostname !== 'factsport.com' || videoUrl.username || videoUrl.password) {
    throw new Error('tiktok_source_must_be_on_verified_factsport_domain');
  }

  const response = await fetch(INBOX_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ source_info: { source: 'PULL_FROM_URL', video_url: videoUrl.toString() } }),
  });
  const result = await response.json() as {
    data?: { publish_id?: unknown };
    error?: { code?: unknown };
  };
  if (!response.ok || result.error?.code !== 'ok' || typeof result.data?.publish_id !== 'string' || !result.data.publish_id) {
    throw new Error(`tiktok_inbox_upload_failed_${response.status}`);
  }
  return { publishId: result.data.publish_id, state: 'awaiting_creator_review' };
}
