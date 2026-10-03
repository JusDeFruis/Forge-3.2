import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export function restrictPrivateFile(file: string): void {
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // POSIX bits are best-effort (no-op or partial on NTFS).
  }
  if (process.platform !== 'win32') return;
  try {
    const user = os.userInfo().username;
    execFileSync('icacls', [file, '/inheritance:r', '/grant:r', `${user}:F`], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // ACL tightening is best-effort; chmod already ran.
  }
}

export function restrictPrivateDir(dir: string): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.chmodSync(dir, 0o700);
  } catch {
    // POSIX bits are best-effort (no-op or partial on NTFS).
  }
  if (process.platform !== 'win32') return;
  try {
    const user = os.userInfo().username;
    execFileSync('icacls', [dir, '/inheritance:r', '/grant:r', `${user}:(OI)(CI)F`], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // ACL tightening is best-effort; children are restricted file by file.
  }
}

export function writePrivateFile(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  /* unpredictable temp name + exclusive create + locked-down mode from the
     first byte: no window where the secret is world-readable, no
     symlink-squat on a guessable name */
  const stamp = `${process.pid}.${randomBytes(8).toString('hex')}`;
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${stamp}.tmp`);
  try {
    fs.writeFileSync(temporary, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    restrictPrivateFile(temporary);
    fs.renameSync(temporary, file);
    restrictPrivateFile(file);
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    }
  }
}
