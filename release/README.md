# release/

This folder is where `npm run pack:exe` writes the built artifacts.

The binaries themselves are deliberately **not** committed: a single Windows
build is about 97 MB, and once it is in the history every clone and every fork
carries that weight forever. Only this file is tracked, so the folder is
visible in the repository and its purpose is documented here.

## Build it yourself

Packaging needs Node 24 or newer (the packer says so up front instead of
failing late). Then:

```bash
npm install
npm test
npm run pack:exe
```

## What you get

| Target | Output |
|---|---|
| Windows x64, single file | `Forge-3.2-windows-x64.exe` |

The Windows build embeds the Node runtime, the web shell and the WebView2
native library, so it runs on any Windows x64 machine without a Node.js
install. The packer stamps the `forge.ico` icon and the `3.2.1` version
resources before injecting the payload. Windows SmartScreen asks for
"More info" then "Run anyway" on unsigned builds.

## Publishing a binary

Attach the built file to a GitHub Release rather than committing it:

```bash
gh release create v3.2.1 release/Forge-3.2-windows-x64.exe \
  --title "Forge 3.2.1" --notes "See CHANGELOG.md"
```

Four single-file artifacts, one per platform, all built natively on GitHub
Actions (SEA cannot cross-build):

| Runner | Command | Output |
|---|---|---|
| Windows x64 | `npm run pack:exe` | `Forge-3.2-windows-x64.exe` |
| Linux x64 | `npm run pack:bin -- --target=linux-x64` | `Forge-3.2-linux-x64` |
| macOS arm64 | `npm run pack:bin -- --target=darwin-arm64` | `Forge-3.2-macos-arm64` |
| macOS x64 | `npm run pack:bin -- --target=darwin-x64` | `Forge-3.2-macos-x64` |

With no `--target` the packer builds for its own host. macOS binaries are
ad-hoc signed (Gatekeeper still asks on first download — that needs a paid
Developer ID). On first launch the Linux binary checks for the WebKitGTK 4.1
runtime and installs it through the distro package manager (apt, dnf, pacman
or zypper — the system asks for permission first); without a supported
manager it prints manual instructions instead of linker-crashing.