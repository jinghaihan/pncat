import * as c from 'ansis'
import { describe, expect, it } from 'vitest'
import { highlightYAML } from '../src/utils/yaml'

describe('highlightYAML', () => {
  it('highlight basic yaml content with version specifiers', () => {
    const yaml = [
      `express: 4.12.x`,
      `lodash: ^4.13.19`,
      `webpack: ~1.9.10`,
      `typescript: '3.5'`,
      `vitest: ">=2.0.0-beta"`,
    ].join('\n')

    const result = highlightYAML(yaml)

    const expectResult = [
      `${c.cyan('express:')} ${c.green('4.12.x')}`,
      `${c.cyan('lodash:')} ${c.green('^4.13.19')}`,
      `${c.cyan('webpack:')} ${c.green('~1.9.10')}`,
      `${c.cyan('typescript:')} '${c.green('3.5')}'`,
      `${c.cyan('vitest:')} "${c.green('>=2.0.0-beta')}"`,
    ].join('\n')

    expect(result).toEqual(expectResult)
  })

  it('highlight pnpm-workspace.yaml catalog structure', () => {
    const yaml = [
      `packages:`,
      `  - "packages/*"`,
      `catalog:`,
      `  react: ^18.2.0`,
      `  react-dom: ^18.2.0`,
      `catalogs:`,
      `  frontend:`,
      `    vue: ^3.3.4`,
      `    react: ^18.0.0`,
      `  build:`,
      `    vite: ^4.4.9`,
      `    webpack: ^5.88.2`,
    ].join('\n')

    const result = highlightYAML(yaml)

    const expectResult = [
      `${c.magenta('packages:')}`,
      `${c.yellow('  - "packages/*"')}`,
      `${c.magenta('catalog:')}`,
      `${c.cyan('  react:')} ${c.green('^18.2.0')}`,
      `${c.cyan('  react-dom:')} ${c.green('^18.2.0')}`,
      `${c.magenta('catalogs:')}`,
      `${c.yellow('  frontend:')}`,
      `${c.cyan('    vue:')} ${c.green('^3.3.4')}`,
      `${c.cyan('    react:')} ${c.green('^18.0.0')}`,
      `${c.yellow('  build:')}`,
      `${c.cyan('    vite:')} ${c.green('^4.4.9')}`,
      `${c.cyan('    webpack:')} ${c.green('^5.88.2')}`,
    ].join('\n')

    expect(result).toEqual(expectResult)
  })

  it('handle complex version specifiers', () => {
    const yaml = [
      `react: >=16.8.0`,
      `vue: <4.0.0`,
      `lodash: ~4.17.21`,
      `typescript: ^5.0.0`,
      `webpack: 5.88.2`,
    ].join('\n')

    const result = highlightYAML(yaml)

    const expectResult = [
      `${c.cyan('react:')} ${c.green('>=16.8.0')}`,
      `${c.cyan('vue:')} ${c.green('<4.0.0')}`,
      `${c.cyan('lodash:')} ${c.green('~4.17.21')}`,
      `${c.cyan('typescript:')} ${c.green('^5.0.0')}`,
      `${c.cyan('webpack:')} ${c.green('5.88.2')}`,
    ].join('\n')

    expect(result).toEqual(expectResult)
  })

  it('handle quoted version values', () => {
    const yaml = [
      `typescript: '5.1.6'`,
      `vue: "3.3.4"`,
      `react: '^18.2.0'`,
      `lodash: "~4.17.21"`,
    ].join('\n')

    const result = highlightYAML(yaml)

    const expectResult = [
      `${c.cyan('typescript:')} '${c.green('5.1.6')}'`,
      `${c.cyan('vue:')} "${c.green('3.3.4')}"`,
      `${c.cyan('react:')} '${c.green('^18.2.0')}'`,
      `${c.cyan('lodash:')} "${c.green('~4.17.21')}"`,
    ].join('\n')

    expect(result).toEqual(expectResult)
  })

  it('handle lines without version specifiers', () => {
    const yaml = [
      `packages:`,
      `  - "packages/*"`,
      `  - "apps/*"`,
      `name: workspace`,
      `private: true`,
    ].join('\n')

    const result = highlightYAML(yaml)

    const expectResult = [
      `${c.magenta('packages:')}`,
      `${c.yellow('  - "packages/*"')}`,
      `${c.yellow('  - "apps/*"')}`,
      `${c.magenta('name: workspace')}`,
      `${c.magenta('private: true')}`,
    ].join('\n')

    expect(result).toEqual(expectResult)
  })

  it('handle version specifiers with pre-release tags', () => {
    const yaml = [
      `vue: 3.3.4-beta.1`,
      `typescript: 5.1.6-rc.0`,
      `webpack: 5.88.2-alpha.1`,
    ].join('\n')

    const result = highlightYAML(yaml)

    const expectResult = [
      `${c.cyan('vue:')} ${c.green('3.3.4-beta.1')}`,
      `${c.cyan('typescript:')} ${c.green('5.1.6-rc.0')}`,
      `${c.cyan('webpack:')} ${c.green('5.88.2-alpha.1')}`,
    ].join('\n')

    expect(result).toEqual(expectResult)
  })

  it('handle indentation levels with proper color coding', () => {
    const yaml = [
      `catalogs:`,
      `  react17:`,
      `    react: ^17.0.2`,
      `    react-dom: ^17.0.2`,
      `  react18:`,
      `    react: ^18.2.0`,
      `    react-dom: ^18.2.0`,
    ].join('\n')

    const result = highlightYAML(yaml)

    const expectResult = [
      `${c.magenta('catalogs:')}`,
      `${c.yellow('  react17:')}`,
      `${c.cyan('    react:')} ${c.green('^17.0.2')}`,
      `${c.cyan('    react-dom:')} ${c.green('^17.0.2')}`,
      `${c.yellow('  react18:')}`,
      `${c.cyan('    react:')} ${c.green('^18.2.0')}`,
      `${c.cyan('    react-dom:')} ${c.green('^18.2.0')}`,
    ].join('\n')

    expect(result).toEqual(expectResult)
  })

  it('handle single line yaml', () => {
    const yaml = `react: ^18.2.0`
    const result = highlightYAML(yaml)
    const expectResult = `${c.cyan('react:')} ${c.green('^18.2.0')}`
    expect(result).toEqual(expectResult)
  })

  it('handle overrides section', () => {
    const yaml = [
      `overrides:`,
      `  vue: ~3.3.0`,
      `  typescript: '5.1.6'`,
    ].join('\n')

    const result = highlightYAML(yaml)

    const expectResult = [
      `${c.magenta('overrides:')}`,
      `${c.cyan('  vue:')} ${c.green('~3.3.0')}`,
      `${c.cyan('  typescript:')} '${c.green('5.1.6')}'`,
    ].join('\n')

    expect(result).toEqual(expectResult)
  })
})
