import {readFile, writeFile, mkdir, cp, readdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyAssets} from './verify-live2d.mjs';
const root=resolve('resources/live2d');
const sdk=resolve('.cache/sdk/CubismSdkForWeb-5-r.5/Samples/Resources');
const digest=b=>createHash('sha256').update(b).digest('hex');
if(digest(await readFile('.cache/miara_en.zip'))!=='021f44d062d7cc1cbe6ac13e25ef7e1b981db187b8b5c4af521f2cba3613d9a4') throw Error('Miara archive changed');
if(digest(await readFile('.cache/CubismSdkForWeb-5-r.5.zip'))!=='67064a7fb1812cf502f5c4a03bfe12cc638c75a621bb4acf06bb28763df06ba0') throw Error('SDK archive changed');
const models={};
for(const [kind,name,file,origin] of [
 ['haru','Haru','Haru.model3.json',join(root,'haru')],
 ['mao','虹色 Mao','Mao.model3.json',join(sdk,'Mao')],
 ['hiyori','桃濑日和','Hiyori.model3.json',join(sdk,'Hiyori')],
 ['miara','Miara','miara_pro_t03.model3.json',resolve('.cache/miara/runtime')],
 ['rice','Rice','Rice.model3.json',join(sdk,'Rice')],
]) {
 const model=JSON.parse(await readFile(join(origin,file),'utf8')), r=model.FileReferences;
 if(kind==='miara') {r.Motions.TapBody=[...r.Motions.Tap,...r.Motions.Flic];delete r.Motions.Tap;delete r.Motions.Flic;}
 for(const group of Object.values(r.Motions??{})) for(const m of group) delete m.Sound;
 const paths=[r.Moc,...r.Textures,r.Physics,r.Pose,r.DisplayInfo,r.UserData,...(r.Expressions??[]).map(e=>e.File),...Object.values(r.Motions??{}).flat().map(m=>m.File)].filter(Boolean);
 const dest=join(root,kind);await mkdir(dest,{recursive:true});
 if(kind!=='haru') for(const p of paths){await mkdir(join(dest,p,'..'),{recursive:true});await cp(join(origin,p),join(dest,p));}
 await writeFile(join(dest,file),JSON.stringify(model,null,2)+'\n');
 models[kind]={name,file,idle:r.Motions.Idle?.length??0,tap:r.Motions.TapBody?.length??0,expressions:(r.Expressions??[]).map(e=>e.Name)};
}
await cp('.cache/miara/ReadMe.txt',join(root,'licenses/Miara-ReadMe.txt'));
await cp('THIRD_PARTY_NOTICES.md',join(root,'licenses/THIRD_PARTY_NOTICES.md'));
await writeFile('src/shared/character-inventory.json',JSON.stringify(models,null,2)+'\n');
const lock=JSON.parse(await readFile(join(root,'asset-lock.json'),'utf8'));
lock.files=[];
async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const p=prefix+e.name;if(e.isDirectory())await walk(join(dir,e.name),p+'/');else if(p!=='asset-lock.json')lock.files.push({path:p,sha256:digest(await readFile(join(dir,e.name))),mime:p.endsWith('.json')?'application/json':p.endsWith('.png')?'image/png':p.endsWith('.js')?'text/javascript':p.endsWith('.moc3')?'application/octet-stream':'text/plain'});}}
await walk(root);lock.files.sort((a,b)=>a.path.localeCompare(b.path));
lock.sources=lock.sources.filter(s=>!s.url.includes('miara_en.zip'));
lock.sources.push({url:'https://cubism.live2d.com/sample-data/bin/miara/miara_en.zip',license:'Live2D Free Material License and Sample Data Terms; see licenses/Miara-ReadMe.txt',sha256:'021f44d062d7cc1cbe6ac13e25ef7e1b981db187b8b5c4af521f2cba3613d9a4'});
lock.modifications=[...new Set([...lock.modifications,'Mao, Hiyori and Rice from pinned SDK; Miara Tap and Flic motion groups merged into TapBody. Audio omitted.'])];
await verifyAssets(root,lock);await writeFile(join(root,'asset-lock.json'),JSON.stringify(lock,null,2)+'\n');
console.log(models);
