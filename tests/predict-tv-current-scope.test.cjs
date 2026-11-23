const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('free prediction UI and submission API are bound to the dedicated Predict subdomain', () => {
  const helper = read('lib/prediction/public-submission.ts');
  const route = read('app/api/prediction/submit/route.ts');
  const gate = read('app/components/PredictMatchSubmission.tsx');
  const mediaMatchPage = read('app/match/[id]/page.tsx');
  assert.match(helper, /predictionHost === 'predict\.factsport\.com'/);
  assert.match(helper, /host === predictionHost/);
  assert.match(route, /FACTSPORT_PRIVATE_PRODUCT_HOST/);
  assert.match(gate, /requestHost !== configuredHost/);
  assert.match(gate, /FACTSPORT_PREDICTION_SUBMISSION_READY/);
  assert.match(mediaMatchPage, /PredictMatchSubmission/);
  assert.doesNotMatch(mediaMatchPage, /PublicPredictionSubmit|PredictionBoard|WinProbability/);
});

test('Factsport TV fixture planner is evidence-backed, illustrative and offline', () => {
  const planner = read('lib/tv/match-story.ts');
  assert.match(planner, /fact\.verified/);
  assert.match(planner, /fact\.source\.trim\(\)/);
  assert.match(planner, /Illustrative visualization — not actual match footage/);
  assert.match(planner, /crypto\.subtle\.digest\('SHA-256'/);
  assert.doesNotMatch(planner, /fetch\(|https:\/\/|youtube.*upload/i);
});

test('TV social video package remains review-gated and never performs uploads', () => {
  const planner = read('lib/tv/match-story.ts');
  assert.match(planner, /prepareSocialVideoDraft/);
  assert.match(planner, /humanApproved/);
  assert.match(planner, /approved_for_dispatch/);
  assert.match(planner, /rightsReference/);
  assert.doesNotMatch(planner, /fetch\(|youtube.*upload/i);
});

test('YouTube TV upload primitive uses private resumable uploads and disclosure metadata', () => {
  const adapter = read('lib/tv/youtube-resumable-upload.ts');
  assert.match(adapter, /uploadType=resumable/);
  assert.match(adapter, /privacyStatus: 'private'/);
  assert.match(adapter, /containsSyntheticMedia/);
  assert.match(adapter, /refreshYouTubeAccessToken/);
  assert.match(adapter, /Content-Range/);
  assert.match(adapter, /SESSION_URL/);
  assert.doesNotMatch(adapter, /console\.(log|error)/);
});

test('TikTok video transfer remains an approved creator inbox draft', () => {
  const adapter = read('lib/tv/tiktok-draft-upload.ts');
  assert.match(adapter, /inbox\/video\/init/);
  assert.match(adapter, /PULL_FROM_URL/);
  assert.match(adapter, /rightsCleared/);
  assert.match(adapter, /humanApproved/);
  assert.match(adapter, /consentToUpload/);
  assert.match(adapter, /awaiting_creator_review/);
  assert.doesNotMatch(adapter, /console\.(log|error)/);
});
