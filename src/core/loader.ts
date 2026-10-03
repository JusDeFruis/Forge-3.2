import * as fs from 'node:fs';
import * as path from 'node:path';
import { FORGE3_HOME } from './providers';
import { FORGE3_PERSONA, FORGE_PROFILE } from './publicDefaults';
import * as vault from './vault';
import { PromptSource } from './vault';

export const VAULT_PATH = path.join(FORGE3_HOME, 'vault.dat');

export function find_vault(): string | null {
  try {
    return fs.statSync(VAULT_PATH).isFile() ? VAULT_PATH : null;
  } catch {
    return null;
  }
}

export function resolve_source(passphrase?: string | null): {
  source: PromptSource;
  mode: 'vault' | 'sealed-defaults';
} {
  const vault_path = find_vault();
  if (vault_path) {
    const password = passphrase || process.env.FORGE3_VAULT;
    if (!password) {
      throw new Error('FORGE 3.0 vault passphrase: ');
    }
    return { source: vault.LocalVault.open(vault_path, password), mode: 'vault' };
  }
  const source = new vault.LocalVault({
    [vault.PERSONA]: FORGE3_PERSONA,
    [vault.DRAFTER]: FORGE_PROFILE,
  });
  return { source, mode: 'sealed-defaults' };
}
