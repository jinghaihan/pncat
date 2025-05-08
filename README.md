# pncat

<p align="center">
  <img src="/assets/logo.png" alt="logo" width="300"/>
</p>

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

Advanced dependency management for pnpm workspaces with catalog support.

> [!NOTE]
> Enhanced pnpm workspace management with intelligent dependency cataloging, inspired by [taze](https://github.com/antfu-collective/taze) and [@antfu/nip](https://github.com/antfu/nip).

```bash
pnpm add -D pncat
```

## ✨ Features

### 🔍 Detect Catalogable Dependencies

```bash
pncat detect
```

Scans your workspace to identify dependencies that could be moved to catalogs.

![Image](/assets/detect.png)

### 🚀 Smart Catalog Migration

```bash
pncat migrate
```

Automatically groups dependencies by type (lint, test, build) and updates your `pnpm.workspace.yaml`.

![Image](/assets/migrate.png)

> **Migration Guide**
>
> **For new users:** Simply run `pncat migrate`
>
> **Existing catalog users:**
> - Recommended: `pncat revert` → `pncat migrate` (clean migration)
> - Force update: `pnpm migrate -f` (direct conversion)

### ➕ Add with Catalog Support

```bash
pncat add vue
```

Adds packages while automatically managing catalog entries (powered by [@antfu/nip](https://github.com/antfu/nip)).

![Image](/assets/add.png)

### 🗑️ Safe Dependency Removal

```bash
pncat remove vitest
```

Removes packages and cleans up `pnpm.workspace.yaml` when safe.

![Image](/assets/remove.png)

### 🧹 Catalog Cleanup

```bash
pncat clean
```

Identifies and removes unused catalog dependencies.

![Image](/assets/clean.png)

### ⏪ Revert to Standard Dependencies

```bash
pncat revert
```

Moves catalog dependencies back to individual `package.json` files.

![Image](/assets/revert.png)

## ⚙️ Configuration

Create a `pncat.config.ts` file to customize behavior:

```ts
import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  // default execution mode
  mode: 'detect',
  // force cataloging according to rules, ignoring original configurations
  force: false,
  // skip prompt confirmation
  yes: false,
  // custom catalog groups (extends defaults)
  catalogRules: mergeCatalogRules([
    {
      name: 'inlined',
      match: ['@antfu/utils'], // string or RegExp
    },
  ]),
  // allowed protocols in specifier to not be converted to catalog
  allowedProtocols: ['workspace', 'link', 'file'],
  // ignore paths for looking for package.json in monorepo
  ignorePaths: [
    '**/node_modules/**',
    '**/dist/**',
    '**/public/**',
    '**/fixture/**',
    '**/fixtures/**',
  ],
  // ignore package.json that in other workspaces (with their own .git,pnpm-workspace.yaml,etc.)
  ignoreOtherWorkspaces: true,
  // disable catalog for "overrides" package.json field
  depFields: {
    packageManager: false
  }
})
```

## 💡 Why pncat?

Solving pnpm workspace pain points:
- 🔄 Automated catalog dependency management
- 🛡️ Built-in safety checks
- 📊 Workspace-wide dependency analysis
- 🧩 Streamlined catalog operations

## 🛣️ Roadmap

### Core Features
- [x] Catalog detection & migration
- [x] Smart add/remove operations
- [x] Catalog cleanup utility
- [x] Reversion capability

### Advanced
- [x] Config file support
- [x] Custom grouping rules

## License

[MIT](./LICENSE) License © [jinghaihan](https://github.com/xiihn)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/pncat?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/pncat
[npm-downloads-src]: https://img.shields.io/npm/dm/pncat?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/pncat
[bundle-src]: https://img.shields.io/bundlephobia/minzip/pncat?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=pncat
[license-src]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/xiihn/pncat/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/pncat
