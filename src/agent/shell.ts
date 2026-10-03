import { spawn } from 'node:child_process';

export interface ShellResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  timed_out: boolean;
  truncated: boolean;
  duration_ms: number;
}

export interface ShellOptions {
  cwd: string;
  shell?: string;
  timeout_ms?: number;
  max_output?: number;
  signal?: AbortSignal;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Math.trunc(value)));

export function run_command(command: string, options: ShellOptions): Promise<ShellResult> {
  const body = String(command ?? '').trim();
  const kind = String(options.shell ?? '').toLowerCase().startsWith('cmd') ? 'cmd' : 'powershell';
  const timeout = clamp(Number(options.timeout_ms ?? 60000), 1000, 300000);
  const max_output = clamp(Number(options.max_output ?? 32000), 2000, 200000);
  const started = Date.now();

  const finish = (result: Partial<ShellResult>): ShellResult => ({
    ok: Boolean(result.ok),
    code: result.code ?? null,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
    timed_out: Boolean(result.timed_out),
    truncated: Boolean(result.truncated),
    duration_ms: Date.now() - started,
  });

  if (!body) {
    return Promise.resolve(finish({ ok: false, stderr: 'command is empty' }));
  }

  const bin = kind === 'cmd' ? 'cmd.exe' : 'powershell.exe';
  const args =
    kind === 'cmd'
      ? ['/d', '/s', '/c', body]
      : ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-Command', body];

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, {
        cwd: options.cwd,
        windowsHide: true,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      });
    } catch (error) {
      resolve(finish({ ok: false, stderr: error instanceof Error ? error.message : String(error) }));
      return;
    }

    const out: string[] = [];
    const err: string[] = [];
    let used = 0;
    let truncated = false;
    let timed_out = false;
    let settled = false;
    let aborted = options.signal ? options.signal.aborted : false;

    /* the stop button kills the child instead of waiting out the timeout */
    const onAbort = (): void => {
      aborted = true;
      try {
        child?.kill();
      } catch {
        void 0;
      }
    };
    if (options.signal) {
      if (options.signal.aborted) onAbort();
      else options.signal.addEventListener('abort', onAbort, { once: true });
    }

    const take = (target: string[], chunk: Buffer): void => {
      if (truncated) return;
      const text = chunk.toString('utf8');
      if (used + text.length > max_output) {
        target.push(text.slice(0, Math.max(0, max_output - used)));
        truncated = true;
        try {
          child.kill();
        } catch {
          void 0;
        }
        return;
      }
      used += text.length;
      target.push(text);
    };

    child.stdout?.on('data', (chunk: Buffer) => take(out, chunk));
    child.stderr?.on('data', (chunk: Buffer) => take(err, chunk));
    try {
      child.stdin?.end();
    } catch {
      void 0;
    }

    const timer = setTimeout(() => {
      timed_out = true;
      try {
        child.kill();
      } catch {
        void 0;
      }
    }, timeout);

    const done = (code: number | null, spawnError?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', onAbort);
      const stderr = err.join('');
      const message = spawnError ? `${stderr}${stderr ? '\n' : ''}${spawnError.message}` : stderr;
      const stopped = aborted || (options.signal ? options.signal.aborted : false);
      const ok = !spawnError && !timed_out && !stopped && code === 0;
      const notice = timed_out
        ? `command timed out after ${Math.round(timeout / 1000)}s`
        : stopped
          ? 'stopped by user'
          : '';
      resolve(
        finish({
          ok,
          code,
          stdout: out.join(''),
          stderr: [message.trim(), notice].filter(Boolean).join('\n'),
          timed_out,
          truncated,
        }),
      );
    };

    child.on('error', (error: Error) => done(null, error));
    child.on('close', (code: number | null) => done(code));
  });
}
