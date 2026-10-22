import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {assembleDownload} from '../src/download.js';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const pieces = [Buffer.from('MZ-first'),Buffer.from('-second')];
const release = {bytes:15,sha256:digest(Buffer.concat(pieces)),parts:pieces.map((part,i) => ({url:String(i),bytes:part.length,sha256:digest(part)}))};
const fetcher = async url => new Response(pieces[Number(url)],{headers:{'Content-Type':'application/octet-stream'}});
test('static parts reconstruct exactly the executable bytes',async () => {
  const progress = [];
  const result = await assembleDownload(release,n => progress.push(n),fetcher,webcrypto.subtle);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()),Buffer.concat(pieces));
  assert.equal(progress.at(-1),100);
});
test('bad part, bad whole digest, HTML, network failure and empty manifest are rejected',async () => {
  await assert.rejects(assembleDownload({...release,parts:[{...release.parts[0],sha256:'wrong'}]},()=>{},fetcher,webcrypto.subtle),/校验/);
  await assert.rejects(assembleDownload({...release,sha256:'wrong'},()=>{},fetcher,webcrypto.subtle),/完整性/);
  await assert.rejects(assembleDownload(release,()=>{},async()=>new Response('<html>',{headers:{'Content-Type':'text/html'}}),webcrypto.subtle),/格式/);
  await assert.rejects(assembleDownload(release,()=>{},async()=>new Response(null,{status:404}),webcrypto.subtle),/404/);
  await assert.rejects(assembleDownload({parts:[]},()=>{},fetcher,webcrypto.subtle),/没有/);
});
