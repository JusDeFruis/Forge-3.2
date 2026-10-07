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
install. The packer stamps the `forge.ico` icon and the `3.2.0` version
resources before injecting the payload. Windows SmartScreen asks for
"More info" then "Run anyway" on unsigned builds.

## Publishing a binary

Attach the built file to a GitHub Release rather than committing it:

```bash
gh release create v3.2 release/Forge-3.2-windows-x64.exe \
  --title "Forge 3.2" --notes "See CHANGELOG.md"
```

The only release artifact this tree produces is `Forge-3.2-windows-x64.exe`.
Linux and macOS run from source (`npm run build && node dist/main.js`); there
are no single-file packagers for those platforms here.