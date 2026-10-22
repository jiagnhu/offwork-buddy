import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
import {fixture} from './fixtures';import {dateKey} from '../src/core/date';import type {State} from '../src/shared/model';
export async function launchDesktop(change?:(state:State)=>void){
 const data=await mkdtemp(path.join(tmpdir(),'buddy-life-'));const state=fixture();state.startDate=dateKey(new Date());change?.(state);await writeFile(path.join(data,'state.json'),JSON.stringify(state));
 const app=await electron.launch({executablePath:process.env.BUDDY_EXECUTABLE,args:process.env.BUDDY_EXECUTABLE?[]:['.'],env:{...Object.fromEntries(Object.entries(process.env).filter(([k])=>k!=='ELECTRON_RUN_AS_NODE')),BUDDY_DATA_DIR:data}});
 await expect.poll(()=>app.windows().some(w=>w.url().endsWith('index.html'))).toBe(true);
 const page=app.windows().find(w=>w.url().endsWith('index.html'))!;await expect.poll(()=>page.evaluate(()=>typeof window.buddy)).toBe('object');
 return {app,page,data,cleanup:async()=>{await app.close();await rm(data,{recursive:true,force:true})}};
}
