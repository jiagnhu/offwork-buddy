import { test, expect } from 'vitest';
import { resolveLive2dAsset } from '../src/main/live2d-assets';
const lock={sdkVersion:'test',frameworkCommit:'test',modelCommit:'test',sources:[],modifications:[],files:[{path:'haru/Haru.model3.json',mime:'application/json',sha256:''}]};

test.each(['tororo', 'hijiki'])('serves locked %s assets but rejects unlisted files', kind => {
  const path = `${kind}/model.model3.json`;
  const expanded = {...lock, files:[...lock.files, {path, mime:'application/json', sha256:''}]};
  expect(resolveLive2dAsset(`buddy-live2d://assets/${path}`, expanded)?.relativePath).toBe(path);
  expect(resolveLive2dAsset(`buddy-live2d://assets/${kind}/missing.png`, expanded)).toBeNull();
});

test('rejects removed Arisa assets even in an old lock', () => {
  const path = 'arisa/mtn/Tap@body.motion3.json';
  expect(resolveLive2dAsset(`buddy-live2d://assets/${path}`, {...lock,files:[{path,mime:'application/json',sha256:''}]})).toBeNull();
});
test('resolves only exact whitelisted model paths',()=>{
  expect(resolveLive2dAsset('buddy-live2d://assets/haru/Haru.model3.json',lock)).toEqual({relativePath:'haru/Haru.model3.json',mime:'application/json'});
});
test.each(['https://assets/haru/Haru.model3.json','buddy-live2d://other/haru/Haru.model3.json','buddy-live2d://user@assets/haru/Haru.model3.json','buddy-live2d://assets:80/haru/Haru.model3.json','buddy-live2d://assets/haru/Haru.model3.json?q=1','buddy-live2d://assets/haru/Haru.model3.json#x','buddy-live2d://assets/haru/%2e%2e/haru/Haru.model3.json','buddy-live2d://assets/haru/../haru/Haru.model3.json','buddy-live2d://assets/haru/%ZZ','buddy-live2d://assets/haru\\Haru.model3.json','buddy-live2d://assets/haru/other.json'])('rejects unsafe URL %s',url=>expect(resolveLive2dAsset(url,lock)).toBeNull());
