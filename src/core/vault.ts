import * as fs from 'node:fs';
import { CryptoError, deriveFernetKey, sealSecrets, unsealSecrets } from './crypto';

export const _KDF_ITERS = 600_000;
export const _MAGIC = 'FORGE3-VAULT-1';

export class VaultError extends Error {}

export function _derive(passphrase: string, salt: Buffer): string {
  return deriveFernetKey(passphrase, salt);
}

export function seal(secrets: Record<string, string>, passphrase: string): string {
  if (!passphrase) {
    throw new VaultError('refusing to seal with an empty passphrase');
  }
  try {
    return sealSecrets(secrets, passphrase);
  } catch (error) {
    if (error instanceof CryptoError) {
      throw new VaultError(error.message);
    }
    throw error;
  }
}

export function unseal(blob: string, passphrase: string): Record<string, string> {
  try {
    return unsealSecrets(blob, passphrase);
  } catch (error) {
    if (error instanceof CryptoError) {
      throw new VaultError(error.message);
    }
    throw error;
  }
}

export abstract class PromptSource {
  abstract get(name: string): string;

  abstract names(): string[];

  has(name: string): boolean {
    return this.names().includes(name);
  }
}

export class LocalVault extends PromptSource {
  _secrets: Record<string, string>;

  constructor(secrets: Record<string, string>) {
    super();
    this._secrets = secrets;
  }

  static open(path: string, passphrase: string): LocalVault {
    let exists = false;
    try {
      exists = fs.statSync(path).isFile();
    } catch {
      exists = false;
    }
    if (!exists) {
      throw new VaultError(`no vault at ${path}`);
    }
    return new LocalVault(unseal(fs.readFileSync(path, 'utf8'), passphrase));
  }

  override get(name: string): string {
    /* hasOwn, not `in`: `in` walks the prototype chain, so
       get('constructor') would hand back the Object constructor */
    if (!Object.hasOwn(this._secrets, name)) {
      throw new VaultError(`vault has no secret named '${name}'`);
    }
    return this._secrets[name];
  }

  override names(): string[] {
    return Object.keys(this._secrets).sort();
  }
}

export class RemoteVault extends PromptSource {
  base_url: string;
  token: string | null;

  constructor(base_url: string, token: string | null = null) {
    super();
    this.base_url = base_url.replace(/\/+$/, '');
    this.token = token;
  }

  override get(name: string): string {
    throw new Error(
      'RemoteVault (hosted-prompt model B) is not wired yet — use LocalVault. ' +
        'When built, the prompt stays server-side and is never returned to the client.',
    );
  }

  override names(): string[] {
    throw new Error('RemoteVault is not wired yet');
  }
}

export const PERSONA = 'assistant.persona';
export const PERSONA_ANTHROPIC = 'assistant.persona.anthropic';
export const DRAFTER = 'forge.profile';
