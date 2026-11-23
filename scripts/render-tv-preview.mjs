#!/usr/bin/env node

/**
 * Offline proof-of-pipeline renderer for a fictional, synthetic Factsport TV story.
 * Requires the locked Resvg WASM dependency plus FFmpeg/FFprobe on an external render host.
 * It never contacts a provider, reads production data, or publishes/uploads output.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { planMatchStory } from '../lib/tv/match-story.ts';
import { renderMatchStorySvgScenes } from '../lib/tv/svg-scene-renderer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'artifacts', 'factsport-tv-synthetic-preview.mp4');
const require = createRequire(import.meta.url);
const FONT_FILE = process.env.FACTSPORT_FONT_FILE || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, { stdio: 'pipe', maxBuffer: 8 * 1024 * 1024, ...options });
  } catch (error) {
    const details = error.stderr?.toString().trim().slice(-1200) || error.message;
    throw new Error(`${command}_failed: ${details}`);
  }
}

function outputFromArgs(argv) {
  const index = argv.indexOf('--output');
  const output = index >= 0 ? argv[index + 1] : DEFAULT_OUTPUT;
  if (!output || output.startsWith('--') || path.extname(output).toLowerCase() !== '.mp4') {
    throw new Error('usage: node scripts/render-tv-preview.mjs [--output path.mp4]');
  }
  return path.resolve(output);
}

function wrapForFrame(text, maxChars = 36) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

async function buildSyntheticPlan() {
  return planMatchStory({
    matchId: '123e4567-e89b-42d3-a456-426614174000',
    homeTeam: 'SAMPLE CITY (DEMO)',
    awayTeam: 'EXAMPLE UNITED (DEMO)',
    competition: 'Synthetic demo fixture',
    finalScore: { home: 2, away: 1 },
    finishedVerifiedAt: '2026-11-23T20:00:00.000Z',
    rights: { dataCleared: true, assetsCleared: true },
    facts: [
      { id: 'score', kind: 'score', text: 'Synthetic demo score: 2–1', source: 'Synthetic local demo data', observedAt: '2026-11-23T20:00:00.000Z', verified: true, homeScore: 2, awayScore: 1 },
      { id: 'lineup', kind: 'lineup', text: 'Demo starting XI · identities omitted', source: 'Synthetic local demo data', observedAt: '2026-11-23T19:00:00.000Z', verified: true },
      { id: 'goal', kind: 'goal', text: 'Synthetic goal event · 68th minute', source: 'Synthetic local demo data', observedAt: '2026-11-23T19:22:00.000Z', verified: true, minute: 68 },
      { id: 'stat', kind: 'stat', text: 'Demo possession: 54%–46%', source: 'Synthetic local demo data', observedAt: '2026-11-23T20:00:00.000Z', verified: true },
    ],
  });
}

async function main() {
  const output = outputFromArgs(process.argv.slice(2));
  await initWasm(readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  const plan = await buildSyntheticPlan();
  if (plan.status !== 'draft') throw new Error('synthetic_preview_plan_not_ready');
  const frames = renderMatchStorySvgScenes(plan);
  const work = await mkdtemp(path.join(ROOT, '.tv-render-'));
  const segments = [];

  try {
    for (const [index, frame] of frames.entries()) {
      const pngPath = path.join(work, `scene-${index}.png`);
      const brandPath = path.join(work, `scene-${index}-brand.txt`);
      const titlePath = path.join(work, `scene-${index}-title.txt`);
      const disclosurePath = path.join(work, `scene-${index}-disclosure.txt`);
      const videoPath = path.join(work, `scene-${index}.mp4`);
      const artwork = new Resvg(frame.svg, { fitTo: { mode: 'width', value: 1920 } }).render().asPng();
      await writeFile(pngPath, artwork, { mode: 0o600 });
      const scene = plan.scenes[index];
      const sceneText = scene.factIds.map(id => plan.facts.find(fact => fact.id === id)?.text).filter(Boolean).join(' · ');
      await writeFile(brandPath, 'FACTSPORT TV · MATCH STORY · SYNTHETIC DEMO', { mode: 0o600 });
      const title = scene.kind === 'opening_3d'
        ? plan.title.split('|')[0].trim()
        : scene.kind === 'closing_2d' ? `FULL TIME · ${plan.score} · SAMPLE CITY vs EXAMPLE UNITED` : scene.label;
      await writeFile(titlePath, wrapForFrame(title).slice(0, 220), { mode: 0o600 });
      await writeFile(disclosurePath, `${sceneText || 'Synthetic local demo · not a real fixture'} · NOT PUBLISHABLE`, { mode: 0o600 });
      run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-i', pngPath, '-t', '3',
        '-vf', `zoompan=z='min(zoom+0.00035,1.04)':d=75:s=1920x1080:fps=25,drawtext=fontfile=${FONT_FILE}:textfile=${brandPath}:fontcolor=0x67e8f9:fontsize=24:x=(w-text_w)/2:y=145:shadowcolor=black@0.7:shadowx=2:shadowy=2:expansion=none,drawtext=fontfile=${FONT_FILE}:textfile=${titlePath}:fontcolor=white:fontsize=52:line_spacing=12:text_align=center:x=(w-text_w)/2:y=340:shadowcolor=black@0.9:shadowx=3:shadowy=3:expansion=none,drawtext=fontfile=${FONT_FILE}:textfile=${disclosurePath}:fontcolor=0x67e8f9:fontsize=25:x=(w-text_w)/2:y=860:shadowcolor=black@0.9:shadowx=2:shadowy=2:expansion=none,fade=t=in:st=0:d=0.25,fade=t=out:st=2.75:d=0.25,format=yuv420p`,
        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-movflags', '+faststart', videoPath,
      ]);
      segments.push(videoPath);
    }

    const concatList = path.join(work, 'segments.txt');
    await writeFile(concatList, `${segments.map(file => `file '${file}'`).join('\n')}\n`, { mode: 0o600 });
    await mkdir(path.dirname(output), { recursive: true });
    run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concatList,
      '-c', 'copy', '-movflags', '+faststart', output,
    ]);
    const probe = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1', output]);
    process.stdout.write(`Synthetic preview created (fictional; not publishable): ${output}\n${probe.toString().trim()}\n`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
