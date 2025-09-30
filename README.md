# pncat

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

Enhanced <samp><b>[pnpm](https://pnpm.io/catalogs)</b></samp> and <samp><b>[yarn](https://yarnpkg.com/features/catalogs)</b></samp> <code>catalog:</code> management with advanced workspace dependency control.

```bash
pnpm add -D pncat
```

- **Detect** - Scan workspace to identify catalogable dependencies
- **Migrate** - Automatically group dependencies by rules
- **Add** - Install dependencies with catalog support
- **Remove** - Safely remove dependencies with catalog awareness
- **Clean** - Find and remove unused catalog dependencies
- **Revert** - Revert cataloged dependencies to package.json

<p align='center'>
<img src='./assets/help.png' />
</p>

## Usage

### Detect

```bash
pncat detect
```

Scans your workspace to identify dependencies that could be moved to catalogs.

<p align='center'>
<img src='./assets/detect.png' />
</p>

### Migrate

```bash
pncat migrate
```

> [!NOTE]
> To update catalog groups according to rules, run `pncat migrate -f`, or do a clean migration with `pncat revert` → `pncat migrate`.

Automatically groups dependencies by rules (e.g., lint, test, utils), updating both `pnpm-workspace.yaml/.yarnrc.yml` and relevant `package.json`.

Default rules can be found in `src/rules.ts`. To customize rules, create a `pncat.config.ts` file in the root directory.

<p align='center'>
<img src='./assets/migrate.png' />
</p>

### Add

```bash
pncat add dep
```

Add dependencies with prompts and catalogs support (credit to [nip](https://github.com/antfu/nip)). It also supports adding monorepo workspace packages using the `workspace:` protocol.

You can specify a catalog name using `--catalog name`. When no catalog is specified, dependencies are automatically assigned based on your catalog rules configuration.

<p align='center'>
<img src='./assets/add.png' />
</p>

### Remove

```bash
pncat remove dep
```

Display which catalog group is using the dependency. If confirmed, it will remove the dependency from both `pnpm-workspace.yaml/.yarnrc.yml` and `package.json`.

To remove a dependency from all packages in the monorepo, you can use `pnpm remove dep -r` or `pnpm remove dep --recursive` to recursively remove the dependency from all workspace packages.

<p align='center'>
<img src='./assets/remove.png' />
</p>

### Clean

```bash
pncat clean
```

Find unused catalog dependencies and remove them from `pnpm-workspace.yaml/.yarnrc.yml`.

<p align='center'>
<img src='./assets/clean.png' />
</p>

### Revert

```bash
pncat revert
```

Reverts cataloged dependencies to `package.json`. Useful for monorepo restructuring or migration.

<p align='center'>
<img src='./assets/revert.png' />
</p>

You can also revert specific dependencies using:

```bash
pncat revert dep
```

<p align='center'>
<img src='./assets/revert-d.png' />
</p>

## Configuration

Create a `pncat.config.ts` file to customize catalog rules:

```ts
import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  // To extend default rules instead, use: catalogRules: mergeCatalogRules([...])
  catalogRules: [
    {
      name: 'vue',
      match: ['vue', 'vue-router', 'pinia'],
      // smaller numbers represent higher priority
      priority: 15,
      // Advanced: version-specific rules
      specifierRules: [
        { specifier: '<3.0.0', suffix: 'legacy', match: ['vue'] }
      ]
    }
  ],
  // Control how version ranges are processed
  specifierOptions: {
    skipComplexRanges: true,
    allowPreReleases: true,
    allowWildcards: false
  }
})
```

**Catalog Rules:**
- `name`: catalog name (required)
- `match`: packages to include, supports RegExp (required)
- `priority`: smaller numbers represent higher priority (optional)
- `specifierRules`: version-specific rules (optional)
  - `specifier`: semver range like ">=3.0.0", "<2.0.0" (required)
  - `match`: specific packages this rule applies to (optional, defaults to parent match)
  - `name`: complete catalog name (takes priority over suffix)
  - `suffix`: catalog suffix (e.g., "legacy", "modern")

**Specifier Options (optional):**
- `skipComplexRanges`: Skip complex ranges like "||", "-", ">=" (default: true)
- `skipRangeTypes`: Specific range types to skip (overrides skipComplexRanges)
  - `'||'`: Logical OR (e.g., "^3.0.0 || ^4.0.0")
  - `'-'`: Hyphen range (e.g., "1.2.3 - 2.3.4")
  - `'>='`, `'<='`, `'>'`, `'<'`: Comparison ranges
  - `'x'`: Wildcard (e.g., "3.x")
  - `'*'`: Any version
  - `'pre-release'`: Beta/alpha/rc versions
- `allowPreReleases`: Allow beta/alpha/rc versions (default: true)
- `allowWildcards`: Allow wildcard versions like "3.x", "*" (default: false)

## Why pncat?

For monorepo repositories, maintaining consistent dependency versions across multiple packages is crucial. Grouping dependencies can significantly improve project understanding, making it easier to collaborate within teams or keep track of the project's structure.

Currently, pnpm's catalog support is limited. For example, there is no built-in feature for adding or migrating dependencies into specific groups. Managing the catalog manually across the entire project can be time-consuming and error-prone. To address this, pncat was developed.

Additionally, when migrating a specific package in a monorepo that uses catalogs, it's important to also migrate the `pnpm-workspace.yaml` file. This requires manually comparing which catalogs need to be removed. To streamline this process, the `clean` and `revert` commands were introduced to automate this task.

## Inspiration

This project is inspired by and builds upon the excellent work of the following projects:

- [taze](https://github.com/antfu-collective/taze) - provided essential monorepo I/O utilities for reading and parsing `pnpm-workspace.yaml` and `package.json` files across workspace packages
- [nip](https://github.com/antfu/nip) - inspired the interactive prompts and user experience design for dependency management workflows

Special thanks to [@antfu](https://github.com/antfu) for his article [Categorizing Dependencies](https://antfu.me/posts/categorize-deps) which provided great inspiration and guidance during the development of this tool.

## Related Projects

+ [eslint-plugin-pnpm-catalog](https://github.com/onmax/eslint-plugin-pnpm-catalog) by [@onmax](https://github.com/onmax) - ESLint plugin that enforces the use of named catalogs in pnpm workspaces

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
