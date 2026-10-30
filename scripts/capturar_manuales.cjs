/* Rebuild documentation screenshots using synthetic fixtures, never live data. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sfa-documentacion-'));
try{
  // Restore the top scroll position before full-page captures so sticky headers
  // do not cover the ficha. Do not modify the application's verification script.
  const source=fs.readFileSync(path.join(__dirname,'verificar_preparacion.cjs'),'utf8')
    .replaceAll('__dirname',JSON.stringify(__dirname))
    .replaceAll('await page.screenshot(', 'await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(resolve => requestAnimationFrame(resolve)); }); await page.screenshot(');
  const fixture=path.join(directory,'fixtures.cjs');fs.writeFileSync(fixture,source);
  const commands=[['--linked','--home'],['--linked'],['--linked','--people'],['--linked','--portal']];
  for(const args of commands){
    const run=spawnSync(process.execPath,[fixture,...args],{cwd:root,env:process.env,stdio:'inherit'});
    if(run.status!==0)throw Error(`Fixture run failed: ${args.join(' ')}`);
  }
  const target=path.join(root,'docs/manuales/capturas');fs.mkdirSync(target,{recursive:true});
  const files={'preparacion.png':'preparacion-vinculada-1366.png','principal.png':'principal-1366.png','personas.png':'personas-cuidado-1366.png','portal-personas.png':'portal-personas-1366.png','principal-movil.png':'principal-390.png'};
  const manifest={date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Asuncion'}).format(new Date()),data:'fixtures only; no real residents, no external messages or writes',generator:'scripts/capturar_manuales.cjs',fixtureGenerator:'scripts/verificar_preparacion.cjs',commands:commands.map(args=>'node scripts/verificar_preparacion.cjs '+args.join(' ')),captures:[],bundles:[]};
  for(const [name,file]of Object.entries(files)){
    fs.copyFileSync(path.join(root,'build/preparation-qa',file),path.join(target,name));
    manifest.captures.push({file:name,source:'build/preparation-qa/'+file,sha256:hash(path.join(target,name)),kind:'web interface with synthetic API fixtures'});
  }
  function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.js'))manifest.bundles.push({file:path.relative(root,p).split(path.sep).join('/'),sha256:hash(p)});}}
  for(const tree of ['interfaz_web/static','interfaz_web/dist-acceso'])walk(path.join(root,tree));
  fs.writeFileSync(path.join(target,'PROCEDENCIA.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('PASS: documentation captures and provenance refreshed with fictitious data.');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
