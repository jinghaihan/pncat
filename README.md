# pncat

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

## Features

### Detect Catalogable Dependencies

```bash
pncat detect
```

Scans your workspace to identify dependencies that could be moved to catalogs.

![Image](/assets/detect.png)

### Smart Catalog Migration

```bash
pncat migrate
```

Automatically groups dependencies by rules (e.g., lint, test, utils), it updates both `pnpm.workspace.yaml` and relevant `package.json`.

Default rules can be found in `src/rules.ts`. To customize theme, you can create a `pncat.config.ts` file in the root directory.

![Image](/assets/migrate.png)

#### Migration Guide

To preverse existing catalog, run `pncat migrate`, this will only migrate uncataloged dependencies.

To update catalog catalog groups according to rules, run `pncat catalog -f`, or do a clean migration with `pncat revert` → `pncat migrate`.

### Add with Catalog Support

```bash
pncat add vue
```

Add dependencies with prompts and catalogs support (powered by [@antfu/nip](https://github.com/antfu/nip)).

![Image](/assets/add.png)

### Safe Dependency Removal

```bash
pncat remove vitest
```

Display which catalog group is using the dependency. If confirmed, it will remove the dependency from both `pnpm.workspace.yaml` and `package.json`.

![Image](/assets/remove.png)

### Catalog Cleanup

```bash
pncat clean
```

Find unused catalog dependencies and remove them from `pnpm.workspace.yaml`.

![Image](/assets/clean.png)

### Revert Cataloged Dependencies

```bash
pncat revert
```

Reverts cataloged dependencies to `package.json`. Maybe useful for when shared dependencies during monorepo restructuring or migration.

![Image](/assets/revert.png)

## Configuration

Create a `pncat.config.ts` file to customize behavior.

The configuration below shows the default values — you can override only what you need:

```ts
import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  // custom catalog groups (extends defaults)
  catalogRules: mergeCatalogRules([
    {
      name: 'inlined',
      match: ['@antfu/utils'], // string or RegExp
      priority: 0 // smaller numbers represent higher priority
    },
  ]),
  // default execution mode
  mode: 'detect',
  // force cataloging according to rules, ignoring original configurations
  force: false,
  // skip prompt confirmation
  yes: false,
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
  },
  // control how specifier ranges are processed
  specifierOptions: {
    // whether to skip complex version ranges (e.g., "||", "-", ">=16.0.0")
    skipComplexRanges: true,
    // list of specific range types to skip (overrides skipComplexRanges)
    skipRangeTypes: [],
    // whether to allow pre-release versions (e.g., "4.0.0-beta")
    allowPreReleases: true,
    // whether to allow wildcard versions (e.g., "3.x", "*")
    allowWildcards: false
  }
})
```

## Why pncat?

For monorepo repositories, it is crucial to maintain consistent dependency versions across multiple packages. Grouping dependencies can significantly improve project understanding, making it easier to collaborate within teams or keep track of the project’s structure.

Currently, pnpm's catalog support is limited. For example, there is no built-in feature for adding or migrating dependencies into specific groups. Managing the catalog manually across the entire project can be time-consuming and error-prone. To address this, we developed pncat.

Additionally, when migrating a specific package in a monorepo that uses catalogs, it's important to also migrate the `pnpm.workspace.yaml` file. This requires manually comparing which catalogs need to be removed. To streamline this process, we introduced the `clean` and `revert` commands to automate this task.

Special thanks to [@antfu](https://github.com/antfu) — his article [Categorizing Dependencies](https://antfu.me/posts/categorize-deps) provided great inspiration and guidance during the development of this tool.

## Roadmap

### Core Features
- [x] Detect catalogable dependencies
- [x] Migrate to catalogs
- [x] Install dependency with catalog support
- [x] Safely remove dependency
- [x] Cleanup unused catalog dependencies
- [x] Revert cataloged dependencies version to `package.json`

### Advanced
- [x] Config file support
- [x] Custom grouping rules

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
