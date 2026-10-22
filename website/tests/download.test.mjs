import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {verifyDownload} from '../scripts/verify-download.mjs';

test('valid executable, HTML masquerade, wrong size/hash and missing route', async () => {
  const bytes = Buffer.from('MZ-test-executable');
  const expected = {bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const server = createServer((req,res) => {
    if(req.url === '/missing') {res.writeHead(404); res.end(); return;}
    res.setHeader('Content-Type',req.url === '/html' ? 'text/html' : 'application/octet-stream');
    res.end(req.url === '/html' ? '<html>error</html>' : bytes);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await verifyDownload(base,expected);
    await assert.rejects(verifyDownload(base+'/html',expected), /HTML/);
    await assert.rejects(verifyDownload(base,{...expected,bytes:1}), /size/);
    await assert.rejects(verifyDownload(base,{...expected,sha256:'bad'}), /SHA/);
    await assert.rejects(verifyDownload(base+'/missing',expected), /404/);
  } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
});
