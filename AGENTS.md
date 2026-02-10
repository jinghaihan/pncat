# pncat Project Conventions

## Scope
- This file defines repository structure and code placement rules.
- Any new code or refactor must follow this file.

## Core Principles
- Single responsibility per directory.
- High cohesion, low coupling.
- Constants are the single source of truth for literal domains.
- Types derive from constants via `typeof ...[number]`, no duplicate unions.
- Library code throws errors; CLI handles process exit.

## Directory Responsibilities

### `src/constants`
- Only constants and static maps.
- No business logic.
- No local duplicate domain types when type already exists in `src/types`.

### `src/types`
- Only type/interface definitions.
- Type aliases for domains (`Agent`, `DepType`, `RangeMode`) are derived from constants.
- Runtime values are forbidden.

### `src/catalog-handler`
- Package-manager-specific handler implementations and factory.
- Entry/factory file: `src/catalog-handler/index.ts`.

### `src/commands`
- CLI command execution and command orchestration only.
- All CLI subcommands must live under this directory.
- Commands call domain/usecase/library APIs and map results to terminal interaction.
- `process.exit()` is allowed only at the CLI boundary, not in shared library modules.

### `src/catalog-handler/base`
- Shared abstract/base handler implementations only.
- `yaml-workspace.ts` and `json-workspace.ts` must live here.

### `src/io`
- File system and serialization helpers.
- Shared IO helpers used across handlers go here (including current `shared` helpers).
- Use sync/async APIs by scenario, prefer minimal complexity.

### `src/utils`
- Pure helpers without side effects.
- Path/runtime context helpers like `getCwd` belong here.

### `test`
- Test code only.
- Fixtures must live under `test/fixtures/<package-manager>/...`.

## Placement Rules (Mandatory)
- `yaml-workspace.ts` => `src/catalog-handler/base/yaml-workspace.ts`
- `json-workspace.ts` => `src/catalog-handler/base/json-workspace.ts`
- Handler shared IO helpers => `src/io/*`
- `getCwd` => `src/utils/*`
- Do not keep generic helper files under `src/catalog-handler` root.

## Error Handling
- Domain/library code: throw typed errors.
- CLI/command boundary: catch and map to output + exit code.
- No `process.exit()` outside CLI boundary.

## Import Rules
- Do not import from `node_modules/...` paths directly.
- Avoid circular imports between `constants` and `types`.
- Cross-directory imports must use directory entrypoints (barrels), not deep file paths.
  - Good: `from '../io'`, `from '../../types'`, `from '../constants'`
  - Bad: `from '../io/workspace'`, `from '../../types/core'`
- This rule applies to all directories, not only `io`.
- Same-directory internal imports must use explicit file paths:
  - Good: `from './workspace'`, `from './json'`
  - Bad: `from '.'`
- Keep import direction stable:
  - `constants` -> may import `types`
  - `types` -> may import `constants` for derived unions
  - `catalog-handler` -> may import from `constants/types/io/utils` via directory entrypoints

## Testing Rules
- Add fixture-driven tests per package manager.
- Each new handler behavior must have at least one fixture-based test case.
- Keep fixtures minimal and deterministic.
- `describe` titles must be function names (the unit under test), not module or behavior bundles.
- `it` titles must describe different cases for that function.
- Do not repeat the function name in `it` titles when `describe` already names that function.
  - Good: `describe('parseSpec')` + `it('parses scoped package spec')`
  - Bad: `describe('parseSpec')` + `it('parseSpec parses scoped package spec')`
- Do not use `tmpdir`, `mkdtemp`, or runtime temporary directories in tests.
- Prefer static fixtures over runtime IO setup (`mkdir`, `writeFile`, etc.).
- For complex expected outputs, use `toMatchFileSnapshot` with files in `test/snapshots` instead of large inline JSON objects.
- Organize test files by mirroring `src` directory structure.
  - Example: `src/utils/catalog.ts` -> `test/utils/catalog.test.ts`
  - Example: `src/io/workspace.ts` -> `test/io/workspace.test.ts`
  - Example: `src/catalog-handler/index.ts` -> `test/catalog-handler/index.test.ts`
  - Root-level source files map to root-level tests: `src/config.ts` -> `test/config.test.ts`
  - Do not use cross-module aggregate files like `test/io.test.ts` or `test/catalog-handler.test.ts`.
  - Avoid behavior-based filename patterns like `catalog.infer-catalog-name.test.ts`.

## Mandatory Validation Per Change
- After each change iteration, run:
  - `pnpm lint --fix`
  - `pnpm typecheck`
- Both commands must pass before proceeding to the next task.

## Prohibited
- Symlink-based structure tricks.
- Duplicate domain unions across files.
- Hidden side effects in `types` or `constants`.
