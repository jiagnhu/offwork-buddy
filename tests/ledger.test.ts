import {it,expect} from 'vitest';
import {settleThrough,scheduleRule,recalculateRange} from '../src/core/ledger';
import {fixture,rule} from './fixtures';
const now=new Date('2026-01-08T10:00:00+08:00');
it('backfills three missing days and is idempotent',()=>{const state=settleThrough(fixture(),now);expect(Object.keys(state.ledger)).toEqual(['2026-01-05','2026-01-06','2026-01-07']);expect(state.ledger['2026-01-05'].amountCents).toBe(80000);expect(settleThrough(state,now)).toEqual(state)});
it('clock reversal preserves historical records',()=>{const state=settleThrough(fixture(),now);expect(settleThrough(state,new Date('2026-01-06T10:00:00+08:00')).ledger).toEqual(state.ledger)});
it('two edits replace tomorrow version and preserve today',()=>{let s=scheduleRule(fixture(),{...rule,amount:'900'},now);s=scheduleRule(s,{...rule,amount:'1000'},now);expect(s.rules).toHaveLength(2);expect(s.rules[1].effectiveFrom).toBe('2026-01-09');expect(s.rules[0].amount).toBe('800');expect(s.rules[1].amount).toBe('1000')});
it('history changes only after explicit recalculation',()=>{const s=settleThrough(fixture(),now);s.overrides['2026-01-05']=false;expect(settleThrough(s,now).ledger['2026-01-05'].amountCents).toBe(80000);expect(recalculateRange(s,'2026-01-05','2026-01-05',now).ledger['2026-01-05'].amountCents).toBe(0)});
