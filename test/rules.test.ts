import { expect, it } from 'vitest'
import { resolveConfig } from '../src/config'
import { getDepCatalogName } from '../src/utils/rule'

it('catalog group rules', async () => {
  const resolved = await resolveConfig({})

  expect(
    getDepCatalogName({
      name: 'vitest',
      specifier: '^0.0.0',
      source: 'devDependencies',
      catalog: true,
    }, resolved),
  ).toBe('test')

  expect(
    getDepCatalogName({
      name: 'eslint',
      specifier: '^0.0.0',
      source: 'devDependencies',
      catalog: true,
    }, resolved),
  ).toBe('lint')

  expect(
    getDepCatalogName({
      name: '@antfu/eslint-config',
      specifier: '^0.0.0',
      source: 'devDependencies',
      catalog: true,
    }, resolved),
  ).toBe('lint')

  expect(
    getDepCatalogName({
      name: 'eslint-plugin',
      specifier: '^0.0.0',
      source: 'devDependencies',
      catalog: true,
    }, resolved),
  ).toBe('lint')

  expect(
    getDepCatalogName({
      name: 'vite',
      specifier: '^0.0.0',
      source: 'devDependencies',
      catalog: true,
    }, resolved),
  ).toBe('build')

  expect(
    getDepCatalogName({
      name: 'vite-config',
      specifier: '^0.0.0',
      source: 'devDependencies',
      catalog: true,
    }, resolved),
  ).toBe('build')

  expect(
    getDepCatalogName({
      name: 'vite-plugin',
      specifier: '^0.0.0',
      source: 'devDependencies',
      catalog: true,
    }, resolved),
  ).toBe('build')

  expect(
    getDepCatalogName({
      name: 'vue',
      specifier: '^0.0.0',
      source: 'dependencies',
      catalog: true,
    }, resolved),
  ).toBe('frontend')

  expect(
    getDepCatalogName({
      name: 'icon',
      specifier: '^0.0.0',
      source: 'dependencies',
      catalog: true,
    }, resolved),
  ).toBe('icons')

  expect(
    getDepCatalogName({
      name: '@iconify/json',
      specifier: '^0.0.0',
      source: 'dependencies',
      catalog: true,
    }, resolved),
  ).toBe('icons')

  expect(
    getDepCatalogName({
      name: '@iconify-json/lucide',
      specifier: '^0.0.0',
      source: 'dependencies',
      catalog: true,
    }, resolved),
  ).toBe('icons')

  expect(
    getDepCatalogName({
      name: 'iconify-vue',
      specifier: '^0.0.0',
      source: 'dependencies',
      catalog: true,
    }, resolved),
  ).toBe('icons')

  expect(
    getDepCatalogName({
      name: '@types/lodash-es',
      specifier: '^0.0.0',
      source: 'devDependencies',
      catalog: true,
    }, resolved),
  ).toBe('types')
})
