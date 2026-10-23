// Prepare the official Tororo and Hijiki sample models.
import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyAssets } from './verify-live2d.mjs';
const root = resolve('resources/live2d');
const inventory = JSON.parse(await readFile('src/shared/character-inventory.json', 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = ['tororo', 'hijiki'].map(kind => [kind, kind === 'tororo' ? 'Tororo' : 'Hijiki', resolve(`.cache/new-cats/${kind}/runtime`), `${kind}.model3.json`]);
for (const [kind, name, origin, file] of inputs) {
  const raw = await readFile(join(origin, file));
  const model = JSON.parse(raw), r = model.FileReferences;
  {
    r.Motions.TapBody = Object.entries(r.Motions).filter(([group]) => group !== 'Idle').flatMap(([, motions]) => motions);
    r.Motions = {Idle:r.Motions.Idle, TapBody:r.Motions.TapBody};
  }
  const paths = [r.Moc, ...r.Textures, r.Physics, r.Pose, r.DisplayInfo, r.UserData,
    ...(r.Expressions ?? []).map(e=>e.File), ...Object.values(r.Motions ?? {}).flat().map(m=>m.File)].filter(Boolean);
  const dest = join(root, kind);
  await mkdir(dest, {recursive:true});
  for (const p of paths) { await mkdir(join(dest,p,'..'), {recursive:true}); await cp(join(origin,p),join(dest,p)); }
  await writeFile(join(dest,file),JSON.stringify(model,null,2)+'\n');
  inventory[kind] = {name, file, idle:r.Motions?.Idle?.length ?? 0, tap:r.Motions?.TapBody?.length ?? 0, expressions:(r.Expressions ?? []).map(e=>e.Name)};
}
await cp('.cache/new-cats/ReadMe.txt',join(root,'licenses/Tororo-Hijiki-ReadMe.txt'));
await cp('THIRD_PARTY_NOTICES.md',join(root,'licenses/THIRD_PARTY_NOTICES.md'));
await writeFile('src/shared/character-inventory.json',JSON.stringify(inventory,null,2)+'\n');
const lock = JSON.parse(await readFile(join(root,'asset-lock.json'),'utf8'));
lock.files=[];
async function walk(dir,prefix='') {
  for (const e of await readdir(dir,{withFileTypes:true})) {
    const p=prefix+e.name;
    if(e.isDirectory()) await walk(join(dir,e.name),p+'/');
    else if(p!=='asset-lock.json') lock.files.push({path:p,sha256:digest(await readFile(join(dir,e.name))),mime:p.endsWith('.json')?'application/json':p.endsWith('.png')?'image/png':p.endsWith('.js')?'text/javascript':p.endsWith('.moc3')?'application/octet-stream':'text/plain'});
  }
}
await walk(root);lock.files.sort((a,b)=>a.path.localeCompare(b.path));
for(const [archive,url] of [
  ['tororo_hijiki_ja.zip','https://cubism.live2d.com/sample-data/bin/tororo_hijiki/tororo_hijiki_ja.zip'],
]) {
  lock.sources=lock.sources.filter(s=>s.url!==url);
  lock.sources.push({url,sha256:digest(await readFile('.cache/'+archive)),license:'See licenses/THIRD_PARTY_NOTICES.md.'});
}
lock.modifications=[...new Set([...lock.modifications,'Tororo and Hijiki non-idle motion groups mapped to TapBody; original motion data unchanged.'])];
await verifyAssets(root,lock);
await writeFile(join(root,'asset-lock.json'),JSON.stringify(lock,null,2)+'\n');
console.log(inputs.map(([kind])=>[kind,inventory[kind]]));
