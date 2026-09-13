import { describe, expect, it } from 'vitest'
import { parseSearchQuery } from '../../../shared/utils/search-query'

describe('parseSearchQuery', () => {
  it('returns the whole query unkeyed when there is no prefix', () => {
    expect(parseSearchQuery('  svíčková  ')).toEqual({ key: null, term: 'svíčková' })
    expect(parseSearchQuery('')).toEqual({ key: null, term: '' })
  })

  it('recognises the English keys', () => {
    expect(parseSearchQuery('author:admin')).toEqual({ key: 'author', term: 'admin' })
    expect(parseSearchQuery('tag:meal prep')).toEqual({ key: 'tag', term: 'meal prep' })
    expect(parseSearchQuery('ingredient:carrot')).toEqual({ key: 'ingredient', term: 'carrot' })
    expect(parseSearchQuery('name:guláš')).toEqual({ key: 'name', term: 'guláš' })
  })

  it('recognises Czech aliases, case- and diacritics-insensitively', () => {
    expect(parseSearchQuery('Autor:admin')).toEqual({ key: 'author', term: 'admin' })
    expect(parseSearchQuery('Tag:rychlovka')).toEqual({ key: 'tag', term: 'rychlovka' })
    expect(parseSearchQuery('ingredience:mrkev')).toEqual({ key: 'ingredient', term: 'mrkev' })
    expect(parseSearchQuery('název:guláš')).toEqual({ key: 'name', term: 'guláš' })
  })

  it('tolerates whitespace around the colon', () => {
    expect(parseSearchQuery('tag : svátek')).toEqual({ key: 'tag', term: 'svátek' })
  })

  it('keys with an empty term still count as keyed', () => {
    expect(parseSearchQuery('tag:')).toEqual({ key: 'tag', term: '' })
  })

  it('treats unknown prefixes as plain text', () => {
    expect(parseSearchQuery('foo:bar')).toEqual({ key: null, term: 'foo:bar' })
    expect(parseSearchQuery('12:30 oběd')).toEqual({ key: null, term: '12:30 oběd' })
  })
})
