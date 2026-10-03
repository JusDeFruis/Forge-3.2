import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { httpRequest } from '../core/httpTransport';

const MAX_BODY = 400 * 1024;
const MAX_TEXT = 12000;
const MAX_REDIRECTS = 5;

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  text: string;
  truncated: boolean;
  error: string;
}

const decode_entities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&amp;/gi, '&');

const html_to_text = (html: string): string => {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|head|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const text = decode_entities(cleaned)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
};

export async function fetch_page(raw_url: string, signal?: AbortSignal): Promise<FetchResult> {
  const url = String(raw_url ?? '').trim();
  const result: FetchResult = { ok: false, status: 0, url, text: '', truncated: false, error: '' };
  if (!/^https?:\/\//i.test(url)) {
    result.error = 'only http(s) urls are allowed';
    return result;
  }
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      /* every hop — first url and each redirect target — is resolved and
         checked before any byte is requested, so intranet, loopback,
         link-local, and cloud-metadata addresses are unreachable even
         through a redirect chain */
      const target = await assert_public_url(current);
      const response = await httpRequest(target.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'User-Agent': 'Forge-3.2/1.0 (+desktop agent)',
        },
        verify: true,
        redirect: 'manual',
        signal,
      });
      result.status = response.status;
      if (response.status === 301 || response.status === 302 || response.status === 303 ||
          response.status === 307 || response.status === 308) {
        const location = response.headers('location');
        try {
          await response.text();
        } catch {
          /* draining is best effort; the socket is released by cancel below */
        }
        if (!location) {
          result.error = `redirect without a target (HTTP ${response.status})`;
          return result;
        }
        let next: string;
        try {
          next = new URL(location, target.toString()).toString();
        } catch {
          result.error = `bad redirect target: ${location}`;
          return result;
        }
        if (!/^https?:\/\//i.test(next)) {
          result.error = `redirect leaves http(s): ${next.slice(0, 120)}`;
          return result;
        }
        if (hop === MAX_REDIRECTS) {
          result.error = 'too many redirects';
          return result;
        }
        current = next;
        continue;
      }
      if (!response.ok) {
        try {
          await response.text();
        } catch {
          /* see above */
        }
        result.error = `HTTP ${response.status}`;
        return result;
      }
      const chunks: string[] = [];
      let used = 0;
      for await (const line of response.lines()) {
        const piece = `${line}\n`;
        if (used + piece.length > MAX_BODY) {
          result.truncated = true;
          break;
        }
        used += piece.length;
        chunks.push(piece);
      }
      const body = chunks.join('');
      const looks_html = /<(!doctype|html|head|body|div|p|title)\b/i.test(body.slice(0, 4000));
      let text = looks_html ? html_to_text(body) : decode_entities(body).trim();
      if (text.length > MAX_TEXT) {
        text = `${text.slice(0, MAX_TEXT)}\n… [page truncated]`;
        result.truncated = true;
      }
      result.text = text;
      result.ok = Boolean(text);
      if (!text) result.error = 'the page had no readable text';
      return result;
    }
    result.error = 'too many redirects';
    return result;
  } catch (error) {
    if (signal && signal.aborted) result.error = 'stopped by user';
    else result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

/** the agent fetcher may only reach public internet addresses */
async function assert_public_url(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`invalid url: ${raw}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`unsupported scheme: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('urls with credentials are not allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses: string[] = [];
  if (isIP(host)) {
    addresses.push(host);
  } else {
    let records: Array<{ address: string }>;
    try {
      records = await lookup(host, { all: true });
    } catch {
      throw new Error(`cannot resolve ${host}`);
    }
    for (const record of records) addresses.push(record.address);
  }
  if (!addresses.length) throw new Error(`cannot resolve ${host}`);
  for (const address of addresses) {
    if (is_blocked_ip(address)) {
      throw new Error(`private or local addresses are not allowed: ${host}`);
    }
  }
  return url;
}

function is_blocked_ip(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4_blocked(ip);
  if (version === 6) return ipv6_blocked(ip);
  return true;
}

function ipv4_blocked(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; /* this network */
  if (a === 10) return true; /* private */
  if (a === 100 && b >= 64 && b <= 127) return true; /* carrier-grade nat */
  if (a === 127) return true; /* loopback */
  if (a === 169 && b === 254) return true; /* link-local + cloud metadata */
  if (a === 172 && b >= 16 && b <= 31) return true; /* private */
  if (a === 192 && b === 0) return true; /* ietf + test-net-1 */
  if (a === 192 && b === 2) return true; /* test-net-1 */
  if (a === 192 && b === 88 && parts[2] === 99) return true; /* 6to4 relay */
  if (a === 192 && b === 168) return true; /* private */
  if (a === 198 && (b === 18 || b === 19)) return true; /* benchmark */
  if (a === 198 && b === 51 && parts[2] === 100) return true; /* test-net-2 */
  if (a === 203 && b === 0 && parts[2] === 113) return true; /* test-net-3 */
  if (a >= 224) return true; /* multicast + reserved */
  return false;
}

function ipv6_blocked(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, '');
  if (ip === '::1' || ip === '::') return true;
  if (ip.startsWith('::ffff:')) return ipv4_blocked(ip.slice('::ffff:'.length));
  const first = ip.split(':')[0] ?? '';
  if (first === 'fe80' || first === 'fec0') return true; /* link-local / site-local */
  if (first.startsWith('fc') || first.startsWith('fd')) {
    if (/^[0-9a-f]{4}$/.test(first)) return true; /* unique local fc00::/7 */
  }
  if (first.startsWith('ff')) return true; /* multicast */
  if (ip.startsWith('2001:db8')) return true; /* documentation */
  if (ip.startsWith('64:ff9b')) return true; /* translation */
  if (ip === '100::' || ip.startsWith('100::')) return true; /* discard */
  return false;
}
