import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function verifyDownload(url, expected) {
  const response = await fetch(url, {signal:AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (/html/i.test(response.headers.get('content-type') || '')) throw new Error('HTML instead of executable');
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of response.body) { size += chunk.length; hash.update(chunk); }
  if (size !== expected.bytes) throw new Error(`Incorrect size: ${size}`);
  if (hash.digest('hex') !== expected.sha256) throw new Error('SHA-256 mismatch');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [release] = JSON.parse(await readFile(new URL('../src/releases.json',import.meta.url)));
  const url = process.argv[2] || release.url;
  if (!url) throw new Error('Pass an actual download URL');
  await verifyDownload(url,release);
  console.log(`Verified ${release.filename}: size and SHA-256 match`);
}
