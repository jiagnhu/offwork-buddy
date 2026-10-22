import { afterEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyAssets } from '../scripts/verify-live2d.mjs';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, {recursive:true,force:true}))); });
async function fixture(extra: Record<string, unknown> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'buddy-assets-')); roots.push(root);
  await mkdir(join(root, 'haru'));
  const model = JSON.stringify({FileReferences:{Moc:'Haru.moc3',Textures:['texture.png'], ...extra}});
  const contents = {'haru/Haru.model3.json':model,'haru/Haru.moc3':'moc','haru/texture.png':'texture'};
  const files = await Promise.all(Object.entries(contents).map(async ([path,data]) => {
    await writeFile(join(root,path),data);
    return {path,sha256:createHash('sha256').update(data).digest('hex'),mime:path.endsWith('.png')?'image/png':path.endsWith('.json')?'application/json':'application/octet-stream'};
  }));
  return {root, lock:{sdkVersion:'test',frameworkCommit:'test',modelCommit:'test',files,sources:[],modifications:[]}};
}
test('accepts complete unmodified model resources', async()=>{const f=await fixture();await expect(verifyAssets(f.root,f.lock)).resolves.toBeUndefined();});
test('rejects a missing texture', async()=>{const f=await fixture();await rm(join(f.root,'haru/texture.png'));await expect(verifyAssets(f.root,f.lock)).rejects.toThrow(/texture/);});
test('rejects modified model bytes', async()=>{const f=await fixture();await writeFile(join(f.root,'haru/Haru.model3.json'),'{}');await expect(verifyAssets(f.root,f.lock)).rejects.toThrow(/hash/i);});
test('rejects references outside the locked set', async()=>{const f=await fixture({Physics:'../outside.json'});await expect(verifyAssets(f.root,f.lock)).rejects.toThrow(/reference/i);});
test('rejects sound references', async()=>{const f=await fixture({Motions:{TapBody:[{File:'Haru.moc3',Sound:'voice.wav'}]}});await expect(verifyAssets(f.root,f.lock)).rejects.toThrow(/sound/i);});
test('rejects audio files even without model references', async()=>{const f=await fixture();f.lock.files.push({path:'haru/voice.wav',sha256:'',mime:'audio/wav'});await expect(verifyAssets(f.root,f.lock)).rejects.toThrow(/audio/i);});
