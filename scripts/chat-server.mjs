import {build} from 'esbuild';
import {spawn} from 'node:child_process';
await build({entryPoints:['src/server/index.ts'],bundle:true,platform:'node',format:'cjs',outfile:'.cache/chat-server.cjs'});
const child=spawn(process.execPath,['.cache/chat-server.cjs'],{stdio:'inherit',env:process.env});
child.on('exit',code=>{process.exitCode=code??1;});
process.on('SIGINT',()=>child.kill());
