import { test, expect } from '@playwright/test';
import { launchDesktop } from './desktop-helper';
test('only local whitelisted model resources load with sandbox intact',async()=>{
  const s=await launchDesktop();
  try {
    const results=await s.page.evaluate(async()=>{
      const base='buddy-live2d://assets/haru/';
      const model=await fetch(base+'Haru.model3.json');
      const texture=await fetch(base+'Haru.2048/texture_00.png');
      const missing=await fetch(base+'missing.json');
      const post=await fetch(base+'Haru.model3.json',{method:'POST'});
      let external=false;try{await fetch('https://example.com');external=true;}catch{}
      return {model:model.status,mime:model.headers.get('content-type'),texture:texture.status,missing:missing.status,post:post.status,external};
    });
    expect(results).toEqual({model:200,mime:'application/json',texture:200,missing:404,post:405,external:false});
    expect(await s.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>{const p=(w.webContents as any).getLastWebPreferences();return p.sandbox&&p.contextIsolation&&!p.nodeIntegration;}))).toBe(true);
  }finally{await s.cleanup();}
});
