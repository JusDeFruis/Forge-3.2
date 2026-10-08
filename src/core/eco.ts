/* Eco mode: clarify + compress the reader's message before it reaches the
   model, so the turn costs fewer tokens. Deterministic and local — no model
   call, no network. Code is sacred: fenced blocks and inline code pass
   through byte-identical at every level. */

export type EcoMode = 'off' | 'light' | 'standard' | 'ultra';

export const ECO_MODES: EcoMode[] = ['off', 'light', 'standard', 'ultra'];

export function normalize_eco_mode(value: unknown): EcoMode {
  const mode = String(value ?? 'off').trim().toLowerCase();
  return (ECO_MODES as string[]).includes(mode) ? (mode as EcoMode) : 'off';
}

/* rough token estimate, the chars/4 rule every provider dashboard uses */
export function estimate_tokens(text: string): number {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

export interface EcoResult {
  text: string;
  before: number;
  after: number;
  saved_pct: number;
}

/* word boundaries that survive accents: \b is ASCII-only, so use Unicode
   letter/number lookarounds instead. */
const LB = '(?<![\\p{L}\\p{N}_])';
const RB = '(?![\\p{L}\\p{N}_])';

/* whole lines that carry no request: greetings, thanks, lone pleasantries */
const PLEASANTRY_LINES = new RegExp(
  '^\\s*(?:' +
  'salut|bonjour|bonsoir|coucou|hello|hi|hey|yo|' +
  'merci(?:\\s+beaucoup)?|thanks?(?:\\s+you)?|thx|' +
  "s'il\\s+te\\s+pla[iî]t|s'il\\s+vous\\s+pla[iî]t|stp|svp|please" +
  ')\\s*[!.…]*\\s*$',
  'gimu',
);

/* leading greeting glued to the request: "salut, peux-tu…" → "peux-tu…" */
const LEADING_GREETING = new RegExp(
  '^(?:' +
  'salut|bonjour|bonsoir|coucou|hello|hi|hey' +
  ')\\s*[,!;:\\-–—]\\s*',
  'iu',
);

/* inline filler: pure noise in either language. "like" is excluded on
   purpose (it is a verb as often as a filler), and so is "quand même"
   (it can mean "anyway, do it"). */
const FILLER = [
  "s'il te plaît", "s'il vous plaît", '\\bstp\\b', '\\bsvp\\b', '\\bplease\\b',
  '\\bthank you\\b', '\\bthanks\\b', '\\bmerci\\b',
  '\\ben fait\\b', '\\bjuste\\b', 'il faut dire que', 'il est vrai que',
  '\\btu vois\\b', '\\beuh\\b', '\\bben\\b', 'eh bien', '\\bun peu\\b',
  'un petit peu', 'en quelque sorte',
  '\\bactually\\b', '\\bbasically\\b', '\\bjust\\b', '\\breally\\b',
  '\\bvery\\b', 'you know', 'kind of', 'sort of',
];
const FILLER_RE = new RegExp(LB + '(?:' + FILLER.join('|') + ')' + RB, 'giu');

/* sentence openers that add nothing once the "?" or imperative survives */
const OPENER_RE = new RegExp(
  '(^|[.!?…]\\s+)(?:well|so|donc|alors)\\s*,?\\s*',
  'giu',
);

/* "est-ce que tu viens ?" → "tu viens ?" */
const EST_CE_QUE_RE = new RegExp(LB + "est-ce\\s+qu[e']\\s+", 'giu');

/* softeners at the very start: the imperative survives without them */
const SOFTENER_RE = new RegExp(
  '^(?:' +
  'je veux que tu|je voudrais que tu|je voudrai que tu|j’aimerais que tu|j\'aimerais que tu|' +
  'peux-tu|pourrais-tu|pourriez-vous|est-ce que tu peux|' +
  'can you|would you|could you|i want you to|i\'d like you to|i would like you to' +
  ')\\s+',
  'iu',
);

/* repeated words: "le le chat" → "le chat" */
const DUP_WORD_RE = new RegExp(LB + '([\\p{L}\\p{N}_]+)\\s+\\1' + RB, 'giu');

/* French text usually carries French markers; without them "a" is the
   English article, with them it may be the verb avoir — never touch it. */
const FRENCH_MARK = new RegExp(
  '[àâçéèêëîïôûùœæ«»]|\\b(je|tu|il|elle|nous|vous|ils|elles|est|sont|les|des|une|pour|avec|dans|qui|pas|plus|sur|par|aux|une|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|votre|leur|cette|ces|cela|ça|cest|voici|voilà)\\b',
  'iu',
);

const FR_ARTICLES = 'le|la|les|l’|l\'|un|une|des|du|de la|de l’|de l\'|au|aux|ce|cet|cette|ces|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs';
const EN_ARTICLES = 'the|a|an|this|that|these|those|my|your|his|her|its|our|their';

function strip_articles(prose: string): string {
  const french = FRENCH_MARK.test(prose);
  const words = french ? FR_ARTICLES : EN_ARTICLES;
  return prose.replace(new RegExp(LB + '(?:' + words + ')' + RB + "\\s*", 'giu'), '');
}

function squeeze_spaces(prose: string): string {
  return prose
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/* split into {code:boolean, text} runs; code runs are never touched */
function split_runs(text: string): Array<{ code: boolean; text: string }> {
  const runs: Array<{ code: boolean; text: string }> = [];
  const fence = /```[\s\S]*?(?:```|$)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  const push_prose = (chunk: string): void => {
    if (!chunk) return;
    const inline = /(`[^`\n]+`)/g;
    let inner_last = 0;
    let inner: RegExpExecArray | null;
    while ((inner = inline.exec(chunk)) !== null) {
      if (inner.index > inner_last) runs.push({ code: false, text: chunk.slice(inner_last, inner.index) });
      runs.push({ code: true, text: inner[0] });
      inner_last = inner.index + inner[0].length;
    }
    if (inner_last < chunk.length) runs.push({ code: false, text: chunk.slice(inner_last) });
  };
  while ((match = fence.exec(text)) !== null) {
    push_prose(text.slice(last, match.index));
    runs.push({ code: true, text: match[0] });
    last = match.index + match[0].length;
  }
  push_prose(text.slice(last));
  return runs;
}

function light(prose: string): string {
  let out = prose.replace(/\r\n/g, '\n');
  out = out
    .split('\n')
    .filter((line) => !PLEASANTRY_LINES.test(line))
    .join('\n');
  out = out.replace(LEADING_GREETING, '');
  return squeeze_spaces(out);
}

function standard(prose: string): string {
  let out = light(prose);
  out = out.replace(FILLER_RE, '');
  out = out.replace(OPENER_RE, '$1');
  out = out.replace(EST_CE_QUE_RE, '');
  out = out.replace(DUP_WORD_RE, '$1');
  return squeeze_spaces(out);
}

function ultra(prose: string): string {
  let out = standard(prose);
  out = out.replace(SOFTENER_RE, '');
  out = strip_articles(out);
  out = out.replace(DUP_WORD_RE, '$1');
  return squeeze_spaces(out);
}

const LEVEL: Record<Exclude<EcoMode, 'off'>, (prose: string) => string> = {
  light,
  standard,
  ultra,
};

/* fallback chain: an over-squeezed message falls back one level, so ultra
   can never eat the request itself. */
const FALLBACK: Record<Exclude<EcoMode, 'off'>, EcoMode> = {
  ultra: 'standard',
  standard: 'light',
  light: 'off',
};

export function compress_message(raw: string, mode: EcoMode): EcoResult {
  const text = String(raw ?? '');
  const before = estimate_tokens(text);
  if (mode === 'off' || !text.trim()) {
    return { text, before, after: before, saved_pct: 0 };
  }
  let level: EcoMode = mode;
  while (level !== 'off') {
    const fn = LEVEL[level];
    const runs = split_runs(text);
    const squeezed = runs.map((run) => (run.code ? run.text : fn(run.text))).join('');
    /* never ship an empty or gutted message: fall back, worst case the
       original text goes out untouched. */
    if (squeezed.trim() && squeezed.length >= text.length * 0.4) {
      const after = estimate_tokens(squeezed);
      const saved_pct = before <= 0 ? 0 : Math.max(0, Math.round(((before - after) / before) * 100));
      return { text: squeezed, before, after, saved_pct };
    }
    level = FALLBACK[level];
  }
  return { text, before, after: before, saved_pct: 0 };
}
