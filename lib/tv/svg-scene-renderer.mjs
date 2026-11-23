const SVG_WIDTH = 1920;
const SVG_HEIGHT = 1080;
const SOURCE_DIGEST = /^[a-f0-9]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_SCENES = new Set([
  'opening_3d', 'lineups_2d', 'event_illustration_3d', 'statistics_2d', 'closing_2d',
]);

const escapeXml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

function boundedText(value, max = 220) {
  const text = String(value ?? '').trim();
  return text.slice(0, max);
}

function validatePlan(plan) {
  if (!plan || plan.status !== 'draft') throw new Error('tv_story_plan_not_publishable');
  if (plan.rights?.dataCleared !== true || plan.rights?.assetsCleared !== true) throw new Error('tv_story_rights_not_cleared');
  if (!UUID.test(plan.matchId || '')) throw new Error('tv_story_match_id_invalid');
  if (!SOURCE_DIGEST.test(plan.sourceDigest || '')) throw new Error('tv_story_source_digest_invalid');
  if (!boundedText(plan.title, 180)) throw new Error('tv_story_title_missing');
  if (!Array.isArray(plan.facts) || !Array.isArray(plan.scenes) || plan.scenes.length < 1) {
    throw new Error('tv_story_content_missing');
  }
  const facts = new Map();
  for (const fact of plan.facts) {
    if (!fact || fact.verified !== true || !boundedText(fact.id, 100) || !boundedText(fact.text, 1200) ||
        !boundedText(fact.source, 160) || !Number.isFinite(Date.parse(fact.observedAt || ''))) {
      throw new Error('tv_story_unverified_fact');
    }
    facts.set(fact.id, fact);
  }
  for (const scene of plan.scenes) {
    if (!scene || !boundedText(scene.id, 100) || !ALLOWED_SCENES.has(scene.kind) || !Array.isArray(scene.factIds)) {
      throw new Error('tv_story_scene_invalid');
    }
    for (const factId of scene.factIds) {
      if (!facts.has(factId)) throw new Error('tv_story_scene_fact_missing');
    }
    if (scene.kind === 'event_illustration_3d' && !boundedText(scene.disclosure, 180)) {
      throw new Error('tv_story_illustration_disclosure_required');
    }
  }
  if (plan.score !== null && !/^\d{1,2}–\d{1,2}$/.test(plan.score)) throw new Error('tv_story_score_invalid');
  return facts;
}

function frame(kind, title, label, body, footer) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07162d"/><stop offset=".55" stop-color="#0b2750"/><stop offset="1" stop-color="#061326"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="#16c6ee" stop-opacity=".25"/><stop offset="1" stop-color="#16c6ee" stop-opacity="0"/></radialGradient>
    <linearGradient id="pitch" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b7a53"/><stop offset="1" stop-color="#145b43"/></linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="32"/></filter>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <ellipse cx="1510" cy="130" rx="600" ry="420" fill="url(#glow)" filter="url(#soft)"/>
  <path d="M0 850 Q480 730 960 850 T1920 850 V1080 H0Z" fill="#030b17" fill-opacity=".46"/>
  <text x="118" y="116" fill="#67e8f9" font-family="Arial,sans-serif" font-size="25" font-weight="700" letter-spacing="7">FACTSPORT MATCH STORY · DRAFT</text>
  <text x="118" y="200" fill="#fff" font-family="Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="4">${escapeXml(boundedText(kind, 80).toUpperCase())}</text>
  ${body}
  <text x="118" y="1008" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="25">${escapeXml(boundedText(footer, 260))}</text>
  <text x="1802" y="1008" text-anchor="end" fill="#94a3b8" font-family="Arial,sans-serif" font-size="17" letter-spacing="3">REVIEW BEFORE PUBLISHING</text>
</svg>`;
}

function factFooter(facts) {
  if (!facts.length) return 'No additional verified event facts in this scene.';
  return facts.slice(0, 2).map(fact => `Source: ${boundedText(fact.source, 100)} · ${new Date(fact.observedAt).toISOString()}`).join('  |  ');
}

function renderOpening(plan) {
  const body = `<g>
    <ellipse cx="960" cy="650" rx="670" ry="220" fill="#0a1527" stroke="#78d7eb" stroke-opacity=".38" stroke-width="3"/>
    <path d="M290 650 H1630 M960 430 V870" stroke="#d8fbff" stroke-opacity=".48" stroke-width="3"/>
    <ellipse cx="960" cy="650" rx="126" ry="126" fill="none" stroke="#d8fbff" stroke-opacity=".52" stroke-width="3"/>
    <path d="M290 520 H470 V780 H290 M1630 520 H1450 V780 H1630" fill="none" stroke="#d8fbff" stroke-opacity=".5" stroke-width="3"/>
    <text x="960" y="545" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="74" font-weight="800">${escapeXml(boundedText(plan.title, 120))}</text>
    <text x="960" y="705" text-anchor="middle" fill="#67e8f9" font-family="Arial,sans-serif" font-size="32" letter-spacing="8">VERIFIED MATCH STORY</text>
  </g>`;
  return frame('opening_3d', plan.title, 'Abstract 2.5D opening title scene', body, 'Stylized pitch artwork · no match footage or player likenesses');
}

function renderLineups(scene, facts) {
  const items = scene.factIds.map(id => facts.get(id)).filter(Boolean).slice(0, 12);
  const cards = items.map((fact, index) => {
    const y = 410 + index * 48;
    return `<g><rect x="250" y="${y - 34}" width="1420" height="40" rx="12" fill="#fff" fill-opacity=".07" stroke="#bae6fd" stroke-opacity=".14"/>
      <circle cx="286" cy="${y - 14}" r="11" fill="#67e8f9"/><text x="286" y="${y - 8}" text-anchor="middle" fill="#07162d" font-family="Arial,sans-serif" font-size="15" font-weight="700">${index + 1}</text>
      <text x="320" y="${y - 6}" fill="#fff" font-family="Arial,sans-serif" font-size="23">${escapeXml(boundedText(fact.text, 100))}</text></g>`;
  }).join('');
  const body = `<text x="250" y="345" fill="#dbeafe" font-family="Arial,sans-serif" font-size="24">Only supplied lineup facts are listed. No formation or player positions are inferred.</text>${cards || '<text x="250" y="440" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="32">Verified lineup details were not supplied.</text>'}`;
  return frame('lineups_2d', scene.label, '2D lineup fact cards without inferred positions', body, factFooter(items));
}

function renderIllustration(scene, facts) {
  const fact = facts.get(scene.factIds[0]);
  const body = `<g>
    <path d="M450 765 L705 442 H1215 L1470 765 Z" fill="url(#pitch)" stroke="#b7f7db" stroke-opacity=".7" stroke-width="4"/>
    <path d="M705 442 L775 765 M1215 442 L1145 765 M705 442 H1215 M775 765 H1145" fill="none" stroke="#e6fff3" stroke-opacity=".65" stroke-width="3"/>
    <ellipse cx="960" cy="635" rx="164" ry="78" fill="none" stroke="#e6fff3" stroke-opacity=".7" stroke-width="3"/>
    <circle cx="960" cy="635" r="25" fill="#f8fafc" stroke="#67e8f9" stroke-width="6"/>
    <text x="960" y="330" text-anchor="middle" fill="#fef3c7" font-family="Arial,sans-serif" font-size="27" font-weight="700" letter-spacing="5">ILLUSTRATIVE VISUALIZATION · NOT ACTUAL MATCH FOOTAGE</text>
    <text x="960" y="850" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="34">${escapeXml(boundedText(fact?.text || scene.label, 120))}</text>
    <text x="960" y="900" text-anchor="middle" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="21">Abstract scene only · no player, position, trajectory or shot location is represented</text>
  </g>`;
  return frame('event_illustration_3d', scene.label, 'Clearly disclosed abstract illustrative scene', body, factFooter(fact ? [fact] : []));
}

function renderStatistics(scene, facts) {
  const items = scene.factIds.map(id => facts.get(id)).filter(Boolean).slice(0, 6);
  const cards = items.map((fact, index) => {
    const x = 190 + (index % 3) * 520;
    const y = 400 + Math.floor(index / 3) * 220;
    return `<g><rect x="${x}" y="${y}" width="460" height="170" rx="24" fill="#fff" fill-opacity=".08" stroke="#67e8f9" stroke-opacity=".32" stroke-width="2"/>
      <text x="${x + 34}" y="${y + 60}" fill="#fff" font-family="Arial,sans-serif" font-size="24" font-weight="700">${escapeXml(boundedText(fact.text, 72))}</text>
      <text x="${x + 34}" y="${y + 116}" fill="#67e8f9" font-family="Arial,sans-serif" font-size="17">${escapeXml(boundedText(fact.source, 70))}</text></g>`;
  }).join('');
  const body = cards || '<text x="960" y="600" text-anchor="middle" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="34">Verified statistics were not supplied; no values are inferred.</text>';
  return frame('statistics_2d', scene.label, '2D verified statistic cards', body, factFooter(items));
}

function renderClosing(plan, scene, facts) {
  const score = plan.score || '—';
  const body = `<g>
    <text x="960" y="420" text-anchor="middle" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="26" letter-spacing="7">FULL TIME · VERIFIED RESULT</text>
    <text x="960" y="620" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="126" font-weight="900">${escapeXml(score)}</text>
    <text x="960" y="740" text-anchor="middle" fill="#67e8f9" font-family="Arial,sans-serif" font-size="35" font-weight="700">${escapeXml(boundedText(plan.title, 120))}</text>
  </g>`;
  return frame('closing_2d', scene.label, 'Verified full-time score closing card', body, factFooter(scene.factIds.map(id => facts.get(id)).filter(Boolean)));
}

/** Render safe, self-contained SVG scene frames from a rights-cleared verified plan. */
export function renderMatchStorySvgScenes(plan) {
  const facts = validatePlan(plan);
  return plan.scenes.map(scene => {
    let svg;
    switch (scene.kind) {
      case 'opening_3d': svg = renderOpening(plan); break;
      case 'lineups_2d': svg = renderLineups(scene, facts); break;
      case 'event_illustration_3d': svg = renderIllustration(scene, facts); break;
      case 'statistics_2d': svg = renderStatistics(scene, facts); break;
      case 'closing_2d': svg = renderClosing(plan, scene, facts); break;
      default: throw new Error('tv_story_scene_unsupported');
    }
    return {
      sceneId: scene.id,
      kind: scene.kind,
      sourceDigest: plan.sourceDigest.toLowerCase(),
      width: SVG_WIDTH,
      height: SVG_HEIGHT,
      svg,
    };
  });
}
