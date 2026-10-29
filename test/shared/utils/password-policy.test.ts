import { describe, expect, it } from 'vitest'
import {
  PASSWORD_MAX_LENGTH,
  generateTempPassword,
  passwordPolicyMessage,
  passwordPolicyViolations,
} from '../../../shared/utils/password-policy'

describe('passwordPolicyViolations', () => {
  it('accepts a password meeting every rule', () => {
    expect(passwordPolicyViolations('Knedliky2024', 'jana')).toEqual([])
  })

  it('accepts Czech letters as lower/upper case', () => {
    expect(passwordPolicyViolations('ŘEŘICHA-žluťoučká7', 'jana')).toEqual([])
  })

  it('reports each broken rule', () => {
    expect(passwordPolicyViolations('short')).toEqual(['alespoň 10 znaků', 'velké písmeno', 'číslici'])
    expect(passwordPolicyViolations('ALLUPPERCASE1')).toEqual(['malé písmeno'])
    expect(passwordPolicyViolations('A1' + 'a'.repeat(PASSWORD_MAX_LENGTH))).toEqual(['nejvýše 128 znaků'])
  })

  it('rejects a password containing the username, case-insensitively', () => {
    expect(passwordPolicyViolations('MyJana2024pw', 'jana')).toEqual(['nesmí obsahovat uživatelské jméno'])
  })

  it('formats violations into one message', () => {
    expect(passwordPolicyMessage(['malé písmeno', 'číslici'])).toBe('Heslo nesplňuje požadavky: malé písmeno, číslici.')
  })
})

describe('generateTempPassword', () => {
  it('always produces a policy-compliant password', () => {
    for (let i = 0; i < 200; i++) {
      expect(passwordPolicyViolations(generateTempPassword('ab'), 'ab')).toEqual([])
    }
  })
})
