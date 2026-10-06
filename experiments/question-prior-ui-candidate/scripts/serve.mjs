// Loopback static preview only: no directory listing, API, credentials or persistence.
import http from 'node:http';
import { realpath, stat, readFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, extname } from 'node:path';
import { candidate } from './runtime.mjs';
const root=join(candidate,'.qa/web');
const inside=file=>{const rel=relative(root,file);return rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel);};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const target=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!inside(target)){res.writeHead(403);res.end('Outside preview');return;}
    const file=await realpath(target);
    if(!inside(file)||!(await stat(file)).isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{res.writeHead(404);res.end('Build the candidate preview first.');}
});
server.listen(0,'127.0.0.1',()=>console.log(`React candidate preview: http://127.0.0.1:${server.address().port}/`));
process.stdin.setEncoding('utf8');process.stdin.on('data',data=>{if(data.trim()==='stop')server.close(()=>process.exit(0));});
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
