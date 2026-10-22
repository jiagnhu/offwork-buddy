import {it,expect} from 'vitest';
import {parseState} from '../src/shared/schema';
import {fixture} from './fixtures';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadState} from '../src/main/store';
function legacy(){ const s:any=fixture(); s.schemaVersion=1; delete s.growth;delete s.reminderHistory; s.preferences.reducedMotion=true; s.plans={'2026-10-22':[{id:'old',text:'旧计划',completed:true}]};return s;}
it('legacy data migrates without earning retroactive rewards',()=>{
 const old=legacy(),next:any=parseState(old);
 expect(next.schemaVersion).toBe(2);expect(next.growth.points).toBe(0);
 expect(next.plans).toMatchObject(old.plans);expect(next.rules).toEqual(old.rules);
 expect(next.preferences.reducedMotion).toBe(true);expect(next.preferences.movementMode).toBe('bottom');
 expect(parseState(JSON.parse(JSON.stringify(next)))).toEqual(next);
});
it('preserves original legacy bytes before loading upgrade',async()=>{
 const d=await mkdtemp(path.join(tmpdir(),'buddy-migrate-'));try{
 const raw=JSON.stringify(legacy());await writeFile(path.join(d,'state.json'),raw);
 await loadState(d);expect(await readFile(path.join(d,'state.pre-v2.json'),'utf8')).toBe(raw);
 expect(await readFile(path.join(d,'state.json'),'utf8')).toBe(raw);
 }finally{await rm(d,{recursive:true,force:true})}
});
it('failed migration backup leaves primary intact',async()=>{
 const d=await mkdtemp(path.join(tmpdir(),'buddy-migrate-'));try{
 const raw=JSON.stringify(legacy());await writeFile(path.join(d,'state.json'),raw);await mkdir(path.join(d,'state.pre-v2.json'));
 await expect(loadState(d)).rejects.toThrow();expect(await readFile(path.join(d,'state.json'),'utf8')).toBe(raw);
 }finally{await rm(d,{recursive:true,force:true})}
});
