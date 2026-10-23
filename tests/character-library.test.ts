import { test, expect } from 'vitest';
import { parseState, preferencesSchema } from '../src/shared/schema';
import { fixture } from './fixtures';
test('four additional models can be selected and saved', () => {
  for (const character of ['mao', 'hiyori', 'miara', 'rice']) {
    expect(preferencesSchema.safeParse({...fixture().preferences, character}).success).toBe(true);
  }
});

test('Both cats retain independent selections and nicknames through state loading', () => {
  for (const character of ['tororo', 'hijiki']) {
    const state = fixture();
    const next = parseState({...state, preferences: {...state.preferences, character,
      characterNames: {tororo: '小白', hijiki: '小黑'}}});
    expect(next.preferences.character).toBe(character);
    expect(next.preferences.characterNames).toEqual({tororo: '小白', hijiki: '小黑'});
    expect(next.ledger).toEqual(state.ledger);
  }
});
test('retired characters migrate to Haru without changing payroll or plans', () => {
  for (const character of ['pet', 'assistant', 'arisa']) {
    const old = fixture();
    const next = parseState({...old, preferences:{...old.preferences, character}});
    expect(next.preferences.character).toBe('haru');
    expect(next.ledger).toEqual(old.ledger);
    expect(next.plans).toEqual(old.plans);
  }
});
