import {test,expect} from "@playwright/test";
import {launchDesktop} from "./desktop-helper";
test("desktop topmost restores without taking focus or reopening hidden windows",async()=>{
 const s=await launchDesktop(state=>{state.preferences.alwaysOnTop=true;});
 try {
 await s.page.evaluate(()=>window.buddy.openDesktopChat());
 await expect.poll(()=>s.app.windows().some(w=>w.url().endsWith("#desktop-chat"))).toBe(true);
 await s.app.evaluate(({BrowserWindow})=>{
 const wins=BrowserWindow.getAllWindows(); const panel=wins.find(w=>w.webContents.getURL().endsWith("index.html"))!;
 panel.show();panel.focus();for(const w of wins.filter(w=>/#(companion|desktop-chat)$/.test(w.webContents.getURL())))w.setAlwaysOnTop(false);
 });
 await expect.poll(()=>s.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>/#(companion|desktop-chat)$/.test(w.webContents.getURL())).every(w=>w.isAlwaysOnTop()))).toBe(true);
 expect(await s.app.evaluate(({BrowserWindow})=>BrowserWindow.getFocusedWindow()?.webContents.getURL().endsWith("index.html"))).toBe(true);
 await s.page.evaluate(()=>window.buddy.hideCompanion());
 await s.page.waitForTimeout(1800);
 expect(await s.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("#companion"))!.isVisible())).toBe(false);
 }finally{await s.cleanup();}
});
