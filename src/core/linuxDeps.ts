import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';

/* Linux ships no system webview with the binary: the embedded WebKitGTK
   binding loads libwebkit2gtk from the machine at runtime. Rather than dying
   with a dynamic-linker error on a fresh install, Forge checks once at
   startup and installs the library through the distro package manager —
   pkexec shows the system auth dialog, so nothing happens silently. */

export type LinuxPackageManager = 'apt' | 'dnf' | 'pacman' | 'zypper';

const PACKAGES: Record<LinuxPackageManager, string> = {
  apt: 'libwebkit2gtk-4.1-0',
  dnf: 'webkit2gtk4.1',
  pacman: 'webkit2gtk-4.1',
  zypper: 'libwebkit2gtk-4_1-0',
};

const MANAGER_BINS: Array<{ manager: LinuxPackageManager; bin: string }> = [
  { manager: 'apt', bin: '/usr/bin/apt-get' },
  { manager: 'dnf', bin: '/usr/bin/dnf' },
  { manager: 'pacman', bin: '/usr/bin/pacman' },
  { manager: 'zypper', bin: '/usr/bin/zypper' },
];

/** true when a WebKitGTK 4.1 runtime is visible to the loader */
export function webkit_present(ldconfig_output: string): boolean {
  return /libwebkit2gtk-4\.[01][\s.]/.test(String(ldconfig_output || ''));
}

export function package_for(manager: LinuxPackageManager): string {
  return PACKAGES[manager];
}

/** first distro manager found on this machine, or null */
export function detect_manager(exists: (bin: string) => boolean = fs.existsSync): LinuxPackageManager | null {
  for (const { manager, bin } of MANAGER_BINS) {
    try {
      if (exists(bin)) return manager;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function install_command(manager: LinuxPackageManager, pkg: string): string[] {
  switch (manager) {
    case 'apt':
      return ['apt-get', 'install', '-y', pkg];
    case 'dnf':
      return ['dnf', 'install', '-y', pkg];
    case 'pacman':
      return ['pacman', '-S', '--noconfirm', pkg];
    case 'zypper':
      return ['zypper', '--non-interactive', 'install', pkg];
  }
}

export function webkit_manual_hint(manager: LinuxPackageManager | null, pkg: string): string {
  if (!manager) {
    return (
      'Forge needs the WebKitGTK 4.1 system library and no supported package ' +
      'manager was found. Install a webkit2gtk 4.1 package for your distro, ' +
      `then restart Forge (looked for ${pkg || 'webkit2gtk'}).`
    );
  }
  return (
    `Forge needs the WebKitGTK 4.1 system library (${pkg}) and could not ` +
    `install it automatically. Install it yourself, then restart Forge ` +
    `(${install_command(manager, pkg).join(' ')}).`
  );
}

/** Ensure the runtime webview dependency exists. Returns true when Forge may
    start; on failure the caller prints the hint and exits instead of dying
    inside the native binding with a linker error. */
export function ensure_linux_webview_deps(): boolean {
  if (process.platform !== 'linux') return true;
  try {
    const out = execFileSync('ldconfig', ['-p'], { encoding: 'utf8', timeout: 15000 });
    if (webkit_present(out)) return true;
  } catch {
    /* ldconfig missing or unreadable — fall through to the install attempt */
  }
  const manager = detect_manager();
  const pkg = manager ? package_for(manager) : '';
  if (!manager) {
    console.error(`forge: ${webkit_manual_hint(null, 'webkit2gtk 4.1')}`);
    return false;
  }
  try {
    console.error(`forge: installing the WebKitGTK runtime (${pkg}) — the system will ask for permission...`);
    execFileSync('pkexec', install_command(manager, pkg), { stdio: 'inherit', timeout: 600000 });
  } catch {
    console.error(`forge: ${webkit_manual_hint(manager, pkg)}`);
    return false;
  }
  try {
    const out = execFileSync('ldconfig', ['-p'], { encoding: 'utf8', timeout: 15000 });
    if (webkit_present(out)) return true;
  } catch {
    /* fall through to the hint */
  }
  console.error(`forge: ${webkit_manual_hint(manager, pkg)}`);
  return false;
}
