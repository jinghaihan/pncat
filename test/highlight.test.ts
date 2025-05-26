import * as c from 'ansis'
import { expect, it } from 'vitest'
import { highlightYAML } from '../src/utils/yaml'

it('highlight yaml content', () => {
  const yaml = [
    `express: 4.12.x`,
    `lodash: ^4.13.19`,
    `webpack: ~1.9.10`,
    `typescript: '3.5'`,
    `test: ">=2.0.0-beta"`,
  ].join('\n')

  const result = highlightYAML(yaml)

  const expectResult = [
    `${c.cyan('express:')} ${c.green('4.12.x')}`,
    `${c.cyan('lodash:')} ${c.green('^4.13.19')}`,
    `${c.cyan('webpack:')} ${c.green('~1.9.10')}`,
    `${c.cyan('typescript:')} '${c.green('3.5')}'`,
    `${c.cyan('test:')} "${c.green('>=2.0.0-beta')}"`,
  ].join('\n')

  expect(result).toEqual(expectResult)
})
