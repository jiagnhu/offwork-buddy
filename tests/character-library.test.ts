import { test, expect } from 'vitest';
import { parseState, preferencesSchema } from '../src/shared/schema';
import { fixture } from './fixtures';
test('four additional models can be selected and saved', () => {
  for (const character of ['mao', 'hiyori', 'miara', 'rice']) {
    expect(preferencesSchema.safeParse({...fixture().preferences, character}).success).toBe(true);
  }
});

test('Arisa and both cats retain independent selections and nicknames through state loading', () => {
  for (const character of ['arisa', 'tororo', 'hijiki']) {
    const state = fixture();
    const next = parseState({...state, preferences: {...state.preferences, character,
      characterNames: {arisa: '亚里沙', tororo: '小白', hijiki: '小黑'}}});
    expect(next.preferences.character).toBe(character);
    expect(next.preferences.characterNames).toEqual({arisa: '亚里沙', tororo: '小白', hijiki: '小黑'});
    expect(next.ledger).toEqual(state.ledger);
  }
});
test('retired characters migrate to Haru without changing payroll or plans', () => {
  for (const character of ['pet', 'assistant']) {
    const old = fixture();
    const next = parseState({...old, preferences:{...old.preferences, character}});
    expect(next.preferences.character).toBe('haru');
    expect(next.ledger).toEqual(old.ledger);
    expect(next.plans).toEqual(old.plans);
  }
});
