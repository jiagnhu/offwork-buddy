import {test,expect} from '@playwright/test';import {launchDesktop} from './desktop-helper';
test('reminder bubbles preserve focus and hidden companions stay hidden',async()=>{
 const {app,page,cleanup}=await launchDesktop();try{
 await app.evaluate(()=>{const Real=Date;(globalThis as any).clockValue=new Real('2026-10-22T11:54:59+08:00').getTime();(globalThis as any).Date=class extends Real {constructor(value?:any){super(value===undefined?(globalThis as any).clockValue:value)}static now(){return (globalThis as any).clockValue}}});
 await expect.poll(()=>page.evaluate(async()=>(await window.buddy.getSnapshot()).progress.countdownSeconds)).toBe(301);
 // Allow the running reminder scheduler to observe the pre-trigger tick.
 await page.waitForTimeout(1100);
 const focused=await app.evaluate(({BrowserWindow})=>BrowserWindow.getFocusedWindow()?.id);
 await app.evaluate(()=>{(globalThis as any).clockValue+=1000});
 const buddy=app.windows().find(w=>w.url().endsWith('#companion'))!;
 await expect(buddy.locator('.speech-bubble')).toContainText('还有 5 分钟午休');
 expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getFocusedWindow()?.id)).toBe(focused);
 await page.evaluate(()=>window.buddy.hideCompanion());
 await app.evaluate(()=>{(globalThis as any).clockValue=new Date('2026-10-22T12:00:00+08:00').getTime()});
 await expect.poll(()=>page.evaluate(async()=>Object.keys((await window.buddy.getSnapshot()).state.reminderHistory).filter(k=>k.includes('lunch-now')).length)).toBe(1);
 expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('#')).every(w=>!w.isVisible()))).toBe(true);
 }finally{await cleanup()}
});
