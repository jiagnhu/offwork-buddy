import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const project = fileURLToPath(new URL('../',import.meta.url));
const root = await realpath(path.join(project,process.env.SERVE_DIST ? 'dist' : 'src'));
const releases = JSON.parse(await readFile(path.join(root,'releases.json'),'utf8'));
let installer;
if(process.env.INSTALLER_PATH && !process.env.SERVE_DIST) {
  installer = await realpath(process.env.INSTALLER_PATH);
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(installer)) {hash.update(chunk); bytes += chunk.length;}
  if(bytes !== releases[0].bytes || hash.digest('hex') !== releases[0].sha256) throw new Error('Installer integrity check failed');
  releases[0].url = `downloads/${releases[0].filename}`;
}
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server = createServer(async (req,res) => {
  try {
    if(!['GET','HEAD'].includes(req.method)) {res.writeHead(405); res.end(); return;}
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    res.setHeader('X-Content-Type-Options','nosniff');
    if(pathname === '/releases.json') {
      res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store');
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(releases)); return;
    }
    const isInstaller = installer && pathname === `/downloads/${releases[0].filename}`;
    let file = isInstaller ? installer : path.resolve(root,`.${pathname === '/' ? '/index.html' : pathname}`);
    if(!isInstaller) {
      file = await realpath(file);
      const relative = path.relative(root,file);
      if(relative.startsWith('..') || path.isAbsolute(relative)) {res.writeHead(403); res.end(); return;}
    }
    const info = await stat(file);
    if(!info.isFile()) throw new Error('Not a file');
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Length',info.size);
    res.setHeader('Cache-Control','no-cache');
    if(isInstaller) res.setHeader('Content-Disposition',`attachment; filename="${releases[0].filename}"`);
    if(req.method === 'HEAD') {res.end(); return;}
    const stream = createReadStream(file);
    stream.on('error',() => res.destroy()); res.on('close',() => stream.destroy()); stream.pipe(res);
  } catch {if(!res.headersSent) res.writeHead(404); res.end('Not found');}
});
server.listen(Number(process.env.PORT || 4173),'127.0.0.1',() => console.log(`Local: http://127.0.0.1:${server.address().port}`));
