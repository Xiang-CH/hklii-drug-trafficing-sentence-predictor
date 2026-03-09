// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { findAndHighlightText } from './text-matching'

describe('findAndHighlightText', () => {
  it('maps normalized offsets back to the original text without drifting', () => {
    const container = document.createElement('div')
    container.textContent =
      'he had taken those dangerous drugs to the premises for storage and had,\n\nsubsequently, weighed the drugs with an electronic scale'

    findAndHighlightText(
      container,
      'he had taken those dangerous drugs to the premises for storage and had, subsequently, weighed the drugs with an electronic scale',
    )

    const highlight = container.querySelector('mark.text-highlight')
    expect(highlight).not.toBeNull()
    expect(highlight?.textContent).toBe(
      'he had taken those dangerous drugs to the premises for storage and had,\n\nsubsequently, weighed the drugs with an electronic scale',
    )
  })

  it('preserves collapsed whitespace ranges inside shorter matches', () => {
    const container = document.createElement('div')
    container.textContent = 'foo   bar baz'

    findAndHighlightText(container, 'bar baz')

    const highlight = container.querySelector('mark.text-highlight')
    expect(highlight).not.toBeNull()
    expect(highlight?.textContent).toBe('bar baz')
  })
})
