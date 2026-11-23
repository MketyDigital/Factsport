import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMatchStorySvgScenes } from '../lib/tv/svg-scene-renderer.mjs';

function validPlan() {
  return {
    status: 'draft',
    rights: { dataCleared: true, assetsCleared: true },
    matchId: '123e4567-e89b-42d3-a456-426614174000',
    title: 'North <City> vs United',
    score: '2–1',
    sourceDigest: 'a'.repeat(64),
    facts: [
      { id: 'score', kind: 'score', text: 'Verified full-time score: 2–1', source: 'Results Desk', observedAt: '2026-11-23T20:00:00.000Z', verified: true, homeScore: 2, awayScore: 1 },
      { id: 'goal', kind: 'goal', text: 'Goal, 68th minute', source: 'Match Centre', observedAt: '2026-11-23T19:22:00.000Z', verified: true, minute: 68 },
      { id: 'stat', kind: 'stat', text: 'Possession: 54%–46%', source: 'Match Centre', observedAt: '2026-11-23T20:01:00.000Z', verified: true },
    ],
    scenes: [
      { id: 'opening', kind: 'opening_3d', label: 'North City vs United', factIds: [] },
      { id: 'goal-1', kind: 'event_illustration_3d', label: 'Verified goal event', factIds: ['goal'], disclosure: 'Illustrative visualization — not actual match footage.' },
      { id: 'stats', kind: 'statistics_2d', label: 'Verified match statistics', factIds: ['stat'] },
      { id: 'closing', kind: 'closing_2d', label: '2–1 full-time', factIds: ['score'] },
    ],
  };
}

test('renders self-contained 1920x1080 SVG frames from verified plan facts', () => {
  const frames = renderMatchStorySvgScenes(validPlan());
  assert.equal(frames.length, 4);
  assert.ok(frames.every(frame => frame.width === 1920 && frame.height === 1080));
  assert.ok(frames.every(frame => frame.svg.startsWith('<?xml')));
  assert.ok(frames.every(frame => !/\b(?:href|xlink:href)=/i.test(frame.svg)));
  assert.match(frames[0].svg, /North &lt;City&gt; vs United/);
  assert.match(frames[1].svg, /ILLUSTRATIVE VISUALIZATION · NOT ACTUAL MATCH FOOTAGE/);
  assert.match(frames[3].svg, /2–1/);
  assert.ok(frames.every(frame => frame.sourceDigest === 'a'.repeat(64)));
});

test('rejects plans without cleared rights or with a non-draft status', () => {
  const blocked = validPlan();
  blocked.rights.assetsCleared = false;
  assert.throws(() => renderMatchStorySvgScenes(blocked), /rights_not_cleared/);
  const unreviewed = validPlan();
  unreviewed.status = 'needs_data';
  assert.throws(() => renderMatchStorySvgScenes(unreviewed), /not_publishable/);
});

test('rejects unverified facts and scene references that are not present', () => {
  const unverified = validPlan();
  unverified.facts[1].verified = false;
  assert.throws(() => renderMatchStorySvgScenes(unverified), /unverified_fact/);
  const missing = validPlan();
  missing.scenes[1].factIds = ['unknown'];
  assert.throws(() => renderMatchStorySvgScenes(missing), /scene_fact_missing/);
});

test('requires a disclosure for each illustrative event scene', () => {
  const plan = validPlan();
  delete plan.scenes[1].disclosure;
  assert.throws(() => renderMatchStorySvgScenes(plan), /illustration_disclosure_required/);
});
