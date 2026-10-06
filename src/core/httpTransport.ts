import { Agent as UndiciAgent } from 'undici';

export const CONNECT_RETRIES = 4;
export const CONNECT_TIMEOUT_SECONDS = 30;
export const REQUEST_TIMEOUT_SECONDS = 180;

let requestTimeoutSeconds = REQUEST_TIMEOUT_SECONDS;
let connectRetries = CONNECT_RETRIES;

type FetchDispatcher = { close?: () => Promise<void> | void };

let skipTlsDispatcher: FetchDispatcher | null = null;

function dispatcherFor(verify: boolean | undefined): FetchDispatcher | undefined {
  if (verify !== false) return undefined;
  if (skipTlsDispatcher) return skipTlsDispatcher;
  /* static import so the packer bundles undici into the shipped exe —
     a lazy require() would stay external and crash with MODULE_NOT_FOUND */
  skipTlsDispatcher = new UndiciAgent({ connect: { rejectUnauthorized: false } });
  return skipTlsDispatcher;
}

export function setRequestTimeout(seconds: number): void {
  const value = Math.trunc(Number(seconds));
  if (Number.isFinite(value) && value >= 1) requestTimeoutSeconds = value;
}

export function setConnectRetries(count: number): void {
  const value = Math.trunc(Number(count));
  if (Number.isFinite(value) && value >= 1) connectRetries = value;
}

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  verify?: boolean;
  /** seconds of silence before the request is treated as stalled */
  timeout?: number;
  signal?: AbortSignal;
  /** fired on every received chunk — lets the caller tell a live stream
      (a model still reasoning sends bytes) apart from a dead stall */
  onActivity?: () => void;
  /** 'follow' keeps the fetch default; agent web fetches use 'manual' so
      every hop can be re-checked before following it */
  redirect?: 'follow' | 'manual' | 'error';
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  lines(): AsyncIterable<string>;
  events(): AsyncIterable<string>;
  headers(name: string): string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function secureTarget(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`invalid request URL: ${raw}`);
  }
  if (url.protocol === 'https:') return url;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(host)) {
    return url;
  }
  throw new Error(`refusing non-TLS request to ${url.hostname} — provider traffic must be encrypted`);
}

function isConnectFailure(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (!code) return false;
  return ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(code);
}

function connectDelay(attempt: number): number {
  return 250 * 2 ** attempt;
}

function buildBody(body: unknown): { body?: BodyInit; contentType?: string } {
  if (body === undefined || body === null) return {};
  if (typeof body === 'string') return { body, contentType: 'application/json' };
  return { body: JSON.stringify(body), contentType: 'application/json' };
}

async function toResponse(res: Response, cleanup: () => void, bump: () => void): Promise<HttpResponse> {
  return {
    status: res.status,
    ok: res.ok,
    text: () => res.text().finally(cleanup),
    json: <T = unknown,>() => res.json().finally(cleanup) as Promise<T>,
    lines: () => decodeLines(res, cleanup, bump),
    events: () => decodeEvents(res, cleanup, bump),
    headers: (name: string) => res.headers.get(name),
  };
}

async function* decodeLines(res: Response, cleanup: () => void, bump: () => void): AsyncIterable<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    cleanup();
    return;
  }
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      bump();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf('\n');
      while (index !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        yield line;
        index = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.length) yield buffer.replace(/\r$/, '');
  } finally {
    /* release the socket when the consumer walks away early (stop button,
       agent abort, redirect hop) instead of holding it until the server
       gives up */
    try {
      await reader.cancel();
    } catch {
      /* already closed or released — nothing to free */
    }
    cleanup();
  }
}

async function* decodeEvents(res: Response, cleanup: () => void, bump: () => void): AsyncIterable<string> {
  try {
    for await (const line of decodeLines(res, cleanup, bump)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      yield data;
    }
  } finally {
    cleanup();
  }
}

async function attempt(url: string, options: HttpRequestOptions, timeoutMs: number, signal?: AbortSignal): Promise<HttpResponse> {
  const { body, contentType } = buildBody(options.body);
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (contentType && !hasHeader(headers, 'content-type')) headers['content-type'] = contentType;

  const controller = new AbortController();
  const fire = (): void => controller.abort(new Error(`request stalled — no data received for ${Math.round(timeoutMs / 1000)}s`));
  let timer = setTimeout(fire, timeoutMs);
  const bump = (): void => {
    clearTimeout(timer);
    timer = setTimeout(fire, timeoutMs);
    if (options.onActivity) {
      try {
        options.onActivity();
      } catch {
        /* a listener must never break the socket */
      }
    }
  };
  const onAbort = () => controller.abort(signal?.reason instanceof Error ? signal.reason : new Error('aborted'));
  const cleanup = (): void => {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const init: RequestInit & { dispatcher?: FetchDispatcher } = {
    method: options.method || 'GET',
    headers,
    body,
    redirect: options.redirect ?? 'follow',
    signal: controller.signal,
  };
  const dispatcher = dispatcherFor(options.verify);
  if (dispatcher) init.dispatcher = dispatcher;

  try {
    const res = await fetch(url, init);
    bump();
    return await toResponse(res, cleanup, bump);
  } catch (error) {
    cleanup();
    throw error;
  }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

/** Statuses that mean "not right now", not "no". NVIDIA's free tier answers 503
    (and sometimes 429 or 502) while an endpoint is at capacity, and the very
    next call succeeds. Surfacing that to the reader as a failure is wrong, so
    the call is simply made again after a short breath. */
const BUSY_STATUSES = new Set([429, 500, 502, 503, 504]);

/* on 503 the queue can be long: more attempts, and exponential backoff so a
   genuinely busy provider gets a real chance to clear its queue. */
function busyDelay(status: number, attempt: number): number {
  if (status === 503) return Math.min(30000, 2000 * Math.pow(1.7, attempt - 1));
  if (status === 429) return 4000 * attempt;
  return 1200 * attempt;
}

export async function httpRequest(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
  secureTarget(url);
  const timeoutMs = Math.round((options.timeout ?? requestTimeoutSeconds) * 1000);
  const retries = Math.max(1, connectRetries);
  /* a busy endpoint gets several extra chances; on 503 we keep going
     longer because NVIDIA's free tier can queue for a minute or more. */
  const busyRetries = 4;
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    let attemptIndex = 0;
    for (;;) {
      try {
        const res = await attempt(url, options, timeoutMs, options.signal);
        if (!BUSY_STATUSES.has(res.status) || attemptIndex >= busyRetries) return res;
        /* drop the body so the socket is released before waiting */
        try {
          await res.text();
        } catch {
          /* a body that will not read is not a reason to keep it */
        }
        attemptIndex += 1;
        await sleep(busyDelay(res.status, attemptIndex));
        continue;
      } catch (error) {
        lastError = error;
        if (options.signal?.aborted) throw error;
        if (!isConnectFailure(error) || i === retries - 1) throw error;
        await sleep(connectDelay(i));
        break;
      }
    }
  }
  throw lastError;
}
