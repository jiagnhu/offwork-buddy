import {mkdir,cp,readFile,writeFile,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../',import.meta.url));
const dist = path.join(root,'dist');
await mkdir(dist,{recursive:true});
await cp(path.join(root,'src'),dist,{recursive:true});
const releases = JSON.parse(await readFile(path.join(root,'src/releases.json'),'utf8'));
const release = releases[0];
if(process.env.DOWNLOAD_URL) {
  const url = new URL(process.env.DOWNLOAD_URL);
  if(url.protocol !== 'https:') throw new Error('Production download URL must use HTTPS');
  const {verifyDownload} = await import('./verify-download.mjs');
  await verifyDownload(url,release);
  release.url = url.href;
} else if(process.env.INSTALLER_PATH) {
  // Small static parts avoid per-asset hosting limits; client verifies the final binary.
  const data = await readFile(process.env.INSTALLER_PATH);
  if(data.length !== release.bytes || createHash('sha256').update(data).digest('hex') !== release.sha256) throw new Error('Installer does not match release');
  await mkdir(path.join(dist,'downloads'),{recursive:true});
  release.parts = [];
  for(let offset=0,index=0; offset<data.length; offset += 20*1024*1024,index++) {
    const part = data.subarray(offset,offset+20*1024*1024);
    const url = `downloads/${release.filename}.part${index}`;
    await writeFile(path.join(dist,url),part);
    release.parts.push({url,bytes:part.length,sha256:createHash('sha256').update(part).digest('hex')});
  }
}
await writeFile(path.join(dist,'releases.json'),JSON.stringify(releases,null,2));
console.log(`Built ${dist}; download: ${release.url ? 'HTTPS' : release.parts ? 'verified static parts' : 'not configured'}`);
