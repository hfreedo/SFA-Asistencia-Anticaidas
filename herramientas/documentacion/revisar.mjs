import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SFA_PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'build/documentacion-qa');fs.mkdirSync(output,{recursive:true});
const names=['README.md','MANUAL_USO_PC.md','MANUAL_PORTAL_Y_ANDROID.md','GUIA_STACK_TECNOLOGICO.md','GUIA_CODIGO_Y_NEXOS.md','GUIA_EXPOSICION.md','COMPROBACION_Y_DIAGNOSTICO.md','ESTADO_DOCUMENTACION.md'];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
marked.use({renderer:{code({text,lang}){return lang==='mermaid'?`<div class="diagram"><pre class="mermaid">${esc(text)}</pre></div>`:`<pre><code>${esc(text)}</code></pre>`;}}});
const css=`body{margin:0;color:#202020;background:#fff;font:17px/1.65 system-ui,sans-serif}main{box-sizing:border-box;max-width:950px;margin:auto;padding:32px 25px}h1{font-size:30px;line-height:1.25}h2{font-size:23px;margin-top:42px}h3{font-size:19px;margin-top:30px}a{color:#175184}table{border-collapse:collapse;width:100%;font-size:15px}td,th{border:1px solid #ddd;text-align:left;padding:10px;overflow-wrap:anywhere}th{background:#f4f4f4}img{max-width:100%;height:auto;border:1px solid #ddd}pre{overflow-x:auto;padding:15px;background:#f7f7f7;font:14px/1.55 Consolas,monospace}code{overflow-wrap:anywhere}pre code{overflow-wrap:normal}p,li{overflow-wrap:anywhere}.diagram{overflow-x:auto;padding:12px 0}.diagram pre{background:#fff;padding:0}.diagram svg{min-width:560px}strong{color:#000}@media(max-width:600px){body{font-size:16px}main{padding:20px 16px}h1{font-size:26px}table{font-size:13px}td,th{padding:6px}}`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Missing');return;}
 if(file.endsWith('.md')){
  let html=marked.parse(fs.readFileSync(file,'utf8')).replaceAll('<h1>','<h1>');
  html=html.replace(/<h([1-6])>(.*?)<\/h\1>/g,(_,level,text)=>`<h${level} id="${text.replace(/<[^>]*>/g,'').toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu,'').replaceAll(' ','-')}">${text}</h${level}>`);
  res.setHeader('Content-Type','text/html;charset=utf-8');res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main>${html}</main><script type="module">import mermaid from '/herramientas/documentacion/node_modules/mermaid/dist/mermaid.esm.min.mjs';mermaid.initialize({startOnLoad:false,theme:'neutral',securityLevel:'strict',flowchart:{useMaxWidth:true},fontSize:16});try{await mermaid.run();window.docsReady=true;}catch(e){window.docsFailure=String(e);}</script>`);return;
 }
 res.setHeader('Content-Type',file.endsWith('.png')?'image/png':/\.m?js$/.test(file)?'application/javascript':file.endsWith('.json')?'application/json':'text/plain');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;const report=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.SFA_QA_BROWSER ? {executablePath:process.env.SFA_QA_BROWSER} : {})});
 for(const width of [1366,768,390]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  for(const name of names){
   await page.goto(`${origin}/docs/${name}`);
   await page.waitForFunction(()=>window.docsReady||window.docsFailure,{},{timeout:30000});
   const result=await page.evaluate(()=>({failure:window.docsFailure||null,overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0),diagrams:document.querySelectorAll('.mermaid svg').length,headings:document.querySelectorAll('h1').length}));
   report.push({name,width,...result});
   if(result.failure||result.overflow||!result.images||result.headings!==1||errors.length)throw Error(JSON.stringify({name,width,result,errors}));
   await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});
   if(width===1366){ const hs=page.locator('h2'); for(let k=0;k<await hs.count();k++){await hs.nth(k).scrollIntoViewIfNeeded(); await page.screenshot({path:path.join(output,`${name}-seccion-${k}.png`)});}}
  }
  await page.close();
 }
 fs.writeFileSync(path.join(output,'resultados.json'),JSON.stringify(report,null,2));
 console.log(`PASS: ${report.length} document/viewport renders; ${report.reduce((n,r)=>n+r.diagrams,0)} SVG diagram instances; images loaded; no body overflow or JS errors. External requests blocked.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
