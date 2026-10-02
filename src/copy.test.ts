import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SOUNDS } from './sounds/catalog';

/**
 * Copy guard: FOCUS CLAY must not read as a medical/therapy product, must not claim to block
 * the phone (Apps in Toss has no such API), and must not judge the user.
 */
const FORBIDDEN = [
  /치료/, /뇌파/, /ADHD/, /불면증/, /의학적 효과/, /집중력(을|이)? ?(향상|개선|높여)/,
  /차단/, /잠금/, /실패/, /집중력 부족/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|json)$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
  });
}

describe('copy guard', () => {
  it('no medical, phone-blocking or judgemental wording in the app', () => {
    const hits: string[] = [];
    for (const f of files(dirname(fileURLToPath(import.meta.url)))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const re of FORBIDDEN) if (re.test(line)) hits.push(`${f}:${i + 1} ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('the app is called 몰입각 on screen (old name only in comments)', () => {
    const hits: string[] = [];
    for (const f of files(dirname(fileURLToPath(import.meta.url))).filter((f) => f.endsWith('.tsx'))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/FOCUS CLAY/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) hits.push(`${f}:${i + 1} ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('every sound declares source and license', () => {
    for (const s of SOUNDS) {
      expect(['synth', 'file']).toContain(s.source);
      expect(s.license?.name, s.id).toBeTruthy();
      expect(typeof s.license.commercialUse).toBe('boolean');
      expect(typeof s.license.attributionRequired).toBe('boolean');
      if (s.license.attributionRequired) expect(s.license.attribution, s.id).toBeTruthy();
      if (s.source === 'file') expect(s.file, s.id).toBeTruthy();
      else expect(s.synth, s.id).toBeTruthy();
    }
  });

  it('sound ids are unique', () => {
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(SOUNDS.length);
  });
});
