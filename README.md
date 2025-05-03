# pncat

<p align="center">
  <img src="/assets/logo.png" alt="logo" width="300"/>
</p>

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

Enhanced pnpm catalogs management with advanced workspace dependency control.

> [!NOTE]
> This CLI is specifically designed for [pnpm](https://pnpm.io/) workspaces with catalogs support. Inspired by [taze](https://github.com/antfu-collective/taze) and [@antfu/nip](https://github.com/antfu/nip).

```bash
pnpm add -D pncat
```

## Features

### Detect

```bash
pncat detect
```
Scans your workspace to identify all dependencies that could be moved to catalogs.

![Image](/assets/detect.png)

### Migrate

> [!IMPORTANT]
> **Migration Guide for Catalog Users**
> To upgrade to the new auto-grouped catalog system:
>
> **Option 1 (Recommended Clean Migration):**
> 1. Run `pncat revert` to restore dependencies to individual `package.json` files
> 2. Run `pncat migrate` to apply the new grouped structure
>
> **Option 2 (Force Immediate Migration):**
> - Simply run `pnpm migrate -f` to force-convert existing catalogs to the new format
>
> The force flag (`-f`) will bypass version checks and automatically resolve common conflicts.

```bash
pncat migrate
```
Automatically detects catalogable dependencies, intelligently groups them by type (e.g., lint, test, build), scope, or custom rules, and updates your `pnpm.workspace.yaml` configuration seamlessly.

![Image](/assets/migrate.png)

### Add

```bash
pncat add vue
```
Adds packages to your project while automatically managing catalog entries in `pnpm.workspace.yaml`. This feature is powered by [@antfu/nip](https://github.com/antfu/nip).

![Image](/assets/add.png)

### Remove

```bash
pncat remove vitest
```
Removes packages from your project and intelligently cleans up `pnpm.workspace.yaml` when safe.

![Image](/assets/remove.png)

### Clean

```bash
pncat clean
```
Identifies unused catalog dependencies and removes them from `pnpm.workspace.yaml`.

![Image](/assets/clean.png)

### Revert

```bash
pncat revert
```
Moves all catalog dependencies back to individual project `package.json` files.

![Image](/assets/revert.png)

## Config file

With `pncat.config.ts` file, you can configure the same options the command has.

```ts
import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  // default execution mode
  mode: 'detect',
  // force cataloging according to rules, ignoring original configurations
  force: false,
  // skip prompt confirmation
  yes: false,
  // custom catalog rules (extends default rules) or just override
  //
  // Usage examples:
  // 1. Extend default rules (recommended):
  //    mergeCatalogRules([{ name: 'group1', match: ['pkg1'] }])
  //
  // 2. Override all rules (skip defaults):
  //    mergeCatalogRules({ mergeDefaults: false }, [
  //      { name: 'custom-only', match: [/^@scope/] }
  //    ])
  //
  // 3. Mixed patterns support:
  //    match: ['exact-name', /regex-pattern/]
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

## Why?

Managing pnpm catalogs in monorepos currently requires significant manual effort:
- No built-in tools for catalog dependency analysis
- Tedious manual updates to `pnpm.workspace.yaml`
- Risk of orphaned catalog entries
- No easy way to visualize catalog usage

`pncat` solves these problems with:
- Automated catalog dependency management
- Safety checks before modifications
- Workspace-wide analysis capabilities
- Streamlined workflow operations

## Roadmap

### Core Features
- [x] `detect` - Identify catalogable dependencies
- [x] `migrate` - Auto-update pnpm.workspace.yaml
- [x] `add` - Smart package addition with catalog support
- [x] `remove` - Safe package removal with catalog cleanup
- [x] `clean` - Remove unused catalog dependencies
- [x] `revert` - Move catalog deps back to package.json

### Advanced Features
- [x] Support for `pncat.config.js` global configuration
- [x] Custom grouping presets via configuration file

## License

[MIT](./LICENSE) License © [jinghaihan](https://github.com/jinghaihan)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/pncat?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/pncat
[npm-downloads-src]: https://img.shields.io/npm/dm/pncat?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/pncat
[bundle-src]: https://img.shields.io/bundlephobia/minzip/pncat?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=pncat
[license-src]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/jinghaihan/pncat/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/pncat
