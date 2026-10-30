/* Isolated layout/navigation check: fixtures only, no resident data or cloud writes. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.SFA_PLAYWRIGHT_MODULE || 'playwright');
const portal = process.argv.includes('--portal');
const root = path.resolve(__dirname, portal ? '../interfaz_web/dist-acceso' : '../interfaz_web/static');
const output = path.resolve(__dirname, '../build/preparation-qa');
const linked = process.argv.includes('--linked');
const people = process.argv.includes('--people');
const quiet = process.argv.includes('--quiet');
const unverified = process.argv.includes('--unverified');
const independent = process.argv.includes('--independent');
const gpsTest = process.argv.includes('--gps-test');
const home = process.argv.includes('--home') || quiet || gpsTest;
const testPoint = () => ({latitude:-25.3,longitude:-57.6,accuracy_m:8,observed_at:new Date().toISOString(),simulated:true,source:'admin_test'});
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, pathname === '/' ? (portal ? 'acceso.html' : 'index.html') : pathname.replace(/^\/static\//, '').replace(/^\/+/, ''));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.SFA_QA_BROWSER ? { executablePath: process.env.SFA_QA_BROWSER } : {}) });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    if (linked) {
      const user = { id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub: user.id, exp: expires, role: 'authenticated' })).toString('base64url') + '.fixture';
      await page.addInitScript(session => sessionStorage.setItem('sfa-access-session-v1', JSON.stringify(session)), { access_token: token, refresh_token: 'fixture-not-real', token_type: 'bearer', expires_at: expires, expires_in: 3600, user });
      await page.route('https://*.supabase.co/**', route => {
        const pathname = new URL(route.request().url()).pathname;
        const fixtures = {
          '/auth/v1/user': user,
          '/rest/v1/rpc/sfa_accept_team_invites': { accepted: 0 },
          '/rest/v1/rpc/sfa_push_test_targets': { devices: [] },
          '/rest/v1/rpc/sfa_map_position': {position: testPoint()},
          '/rest/v1/rpc/sfa_get_geofence': {can_configure:true,geofence:null},
          '/rest/v1/rpc/sfa_incidents': {can_attend:true,viewer_id:user.id,events:[]},
          '/rest/v1/sfa_events': [],
          '/rest/v1/sfa_samples': [],
          '/rest/v1/sfa_memberships': [{ space_id: 'fixture-space', role: 'admin' }],
          '/rest/v1/sfa_spaces': [{ id: 'fixture-space', name: 'Espacio de demostracion' }],
          '/rest/v1/sfa_residents': [{ id: 'fixture-person', full_name: 'Residente de demostración' }],
          '/rest/v1/rpc/sfa_team': { members: [
            { user_id: user.id, email: user.email, role: 'admin', access: [] },
            { user_id: 'fixture-care', email: 'cuidador@example.invalid', role: 'caregiver', access: [{ resident_id: 'fixture-person', can_configure: false, can_share_location: false }] },
            { user_id: 'fixture-spare', email: 'nuevo-cuidador@example.invalid', role: 'caregiver', access: [] },
          ], invitations: [] },
        };
        if (people && !['GET', 'OPTIONS'].includes(route.request().method()) && !['/rest/v1/rpc/sfa_team', '/rest/v1/rpc/sfa_accept_team_invites', '/rest/v1/rpc/sfa_incidents', '/rest/v1/rpc/sfa_get_geofence', '/rest/v1/rpc/sfa_push_test_targets'].includes(pathname)) errors.push(`Unexpected cloud mutation: ${pathname}`);
        return route.fulfill({ status: fixtures[pathname] ? 200 : 403, contentType: 'application/json', body: JSON.stringify(fixtures[pathname] || {}) });
      });
    }
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR:', error.message); });
    await page.routeWebSocket('**/ws', () => {});
    async function checkPeopleControls() {
      const role = page.getByLabel('Rol', { exact: true });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await role.focus();
      await role.press('Space');
      await page.waitForFunction(() => document.getElementById('team-role')?.getAttribute('data-state') === 'open' && getComputedStyle(document.getElementById('team-role')).borderTopColor === 'rgb(13, 148, 136)');
      const select = await role.evaluate(node => {
        const style = getComputedStyle(node);
        return { height: node.getBoundingClientRect().height, appearance: style.appearance, border: style.borderTopColor, shadow: style.boxShadow };
      });
      assert.equal(select.height, 42, 'Shared selector height');
      assert.equal(select.border, 'rgb(13, 148, 136)', 'Teal focus instead of black browser outline');
      assert.notEqual(select.shadow, 'none');
      const emailHeight = await page.getByLabel('Correo electrónico', { exact: true }).evaluate(node => node.getBoundingClientRect().height);
      assert.equal(emailHeight, select.height, 'Email and role align');
      const selected = await page.locator('.team-assignment:has(input:checked)').evaluate(node => getComputedStyle(node).backgroundColor);
      assert.equal(selected, 'rgb(240, 253, 250)', 'Selected person is visibly distinguished');
      await page.getByRole('listbox').waitFor();
      await page.screenshot({path:path.join(output,`selector-pulido-${page.viewportSize().width}.png`),fullPage:true});
      await page.keyboard.press('Escape');
    }
    async function choose(label, text) {
      await page.getByLabel(label, {exact:true}).click();
      await page.getByRole('option', {name:text,exact:true}).click();
    }
    async function checkConnections(width) {
      await page.getByText('Relaciones de cuidado y envío GPS', { exact: true }).click();
      await page.getByRole('table').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Connections overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `${portal ? 'portal' : 'panel'}-relaciones-${width}.png`), fullPage: true });
      await page.getByText('Relaciones de cuidado y envío GPS', { exact: true }).click();
      await page.getByRole('table').waitFor({ state: 'detached' });
    }
    async function checkTeamDialog() {
      await page.getByRole('button', { name: 'Cerrar formulario', exact: true }).click();
      await page.getByRole('button', { name: 'Añadir cuidador', exact: true }).click();
      await page.getByRole('button', { name: 'Invitar una cuenta nueva', exact: true }).click();
      await page.getByLabel('Correo electrónico', { exact: true }).fill('prueba@example.invalid');
      await choose('Rol', 'Administrador');
      await page.getByRole('button', { name: 'Crear invitación', exact: true }).click();
      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor();
      const backdrop = await page.locator('.team-dialog-backdrop').boundingBox();
      assert.equal(backdrop.x, 0, 'Confirmation covers viewport, not the form');
      assert.equal(backdrop.y, 0, 'Confirmation is not anchored inside a CSS container');
      assert.equal(backdrop.width, page.viewportSize().width);
      assert.equal(backdrop.height, page.viewportSize().height);
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('button', { name: 'Cerrar formulario', exact: true }).click();
    }
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      let status = 200;
      let data = {};
      if (url.pathname === '/api/residents') data = [{ id: 7, full_name: 'Residente de demostración', room: 'Sala de pruebas', is_active: 1, phone: '', medical_notes: '' }];
      else if (url.pathname.endsWith('/geofence')) data = { home_lat: -25.3, home_lng: -57.6, radius_m: 100, address_name: 'Zona de prueba' };
      else if (url.pathname.startsWith('/api/cloud/residents')) { status = 401; data = { detail: { code: 'session_required' } }; }
      else if (url.pathname.endsWith('/location')) data = { resident_id: 7, paired: false, status: 'no_fix', position: null, events: [] };
      else if (url.pathname === '/api/cloud/status') data = { session_active: linked || independent || home, bindings: linked || home ? [{ local_resident_id: 7, resident_id: 'fixture-person', space_id: 'fixture-space', enabled: 1 }] : [], push: { configured: false, last_error: null }, pending: 0, sent: 0, blocked: 0 };
      else if (url.pathname === '/api/ports') data = [];
      else if (url.pathname === '/api/notifications/email') data = { configured: false, deliveries: [] };
      else if (url.pathname === '/api/network-info') data = {url:origin,port:server.address().port,addresses:['127.0.0.1'],lan_available:false};
      if (home && url.pathname === '/api/cloud/residents/7/location') {
        status=200; data={position:{latitude:-25.3,longitude:-57.6,accuracy_m:8,observed_at:new Date(Date.now()-(quiet ? 21711000 : 0)).toISOString()}};
        if (gpsTest) data={position:testPoint()};
      }
      if (gpsTest && url.pathname === '/api/cloud/residents/7/geofence') {status=200;data={can_configure:true,geofence:null};}
      if (home && url.pathname === '/api/cloud/residents/7/incidents') {
        status=200; data={can_attend:false,viewer_id:'fixture',events:[{id:'fixture-exit',event_type:'GEOCERCA_SALIDA',observed_at:new Date().toISOString(),simulated:false,detail:{text:'Salida de demostracion'},actor_id:null,outcome:null,updated_at:null}],zone_status:{state:'outside',last_confirmed:'outside',observed_at:new Date().toISOString()}};
        if (quiet) data={can_attend:false,viewer_id:'fixture',events:[],zone_status:{state:'stale',last_confirmed:'unknown',observed_at:new Date(Date.now()-21711000).toISOString()}};
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    for (const [width, height] of [[1920, 1080], [1366, 768], [390, 844]]) {
      await page.setViewportSize({ width, height });
      if (gpsTest) {
        await page.goto(`${origin}/${portal ? 'acceso.html' : ''}?gps-test=${width}`);
        if (portal) {
          await page.getByLabel('Residente remoto').selectOption('fixture-person');
        } else {
          await page.getByText('PRUEBA · GPS del celular administrador',{exact:true}).waitFor();
          await page.getByRole('button',{name:'Ver mapa y geocerca'}).click();
        }
        await page.getByText('PRUEBA · GPS del celular administrador',{exact:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:'Usar posición recibida como centro'}).isDisabled(),true);
        assert.equal(await page.getByText('Posición reciente',{exact:true}).count(),0);
        await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Test map overflow at ${width}`);
        await page.screenshot({path:path.join(output,`${portal ? 'portal' : 'panel'}-gps-test-${width}.png`),fullPage:true});
        continue;
      }
      if (portal) {
        await page.goto(`${origin}/acceso.html?qa=${width}`);
        await page.getByRole('button', { name: 'Personas y equipo', exact: true }).click();
        await page.getByLabel('Persona cuidada', {exact:true}).waitFor();
        await choose('Persona cuidada', 'Residente de demostración');
        await page.getByText('cuidador@example.invalid', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Dar acceso a esta persona', exact: true }).click();
        assert.equal(await page.getByRole('radio', { name: 'Residente de demostración', exact: true }).isChecked(), true);
        await checkPeopleControls();
        await page.evaluate(() => { window.scrollTo(0,0); return document.fonts.ready; });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Portal overflow at ${width}`);
        await page.screenshot({ path: path.join(output, `portal-personas-${width}.png`), fullPage: true });
        await checkConnections(width);
        await checkTeamDialog();
        continue;
      }
      if (people) {
        await page.goto(`${origin}/?people=${width}`);
        await page.getByRole('button', { name: 'Personas', exact: true }).click();
        await page.getByRole('heading', { name: 'Personas cuidadas', exact: true }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Ficha overflow at ${width}`);
        await page.screenshot({ path: path.join(output, `personas-datos-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Cuidadores y acceso', exact: true }).click();
        await page.getByText('cuidador@example.invalid', { exact: true }).waitFor();
        await page.getByRole('heading', { name: 'Cuidadores asignados' }).waitFor();
        await page.getByRole('button', { name: 'Añadir cuidador', exact: true }).click();
        await choose('Elegir una cuenta existente', 'nuevo-cuidador@example.invalid');
        assert.equal(await page.getByLabel('Correo electrónico', { exact: true }).inputValue(), 'nuevo-cuidador@example.invalid');
        assert.equal(await page.getByRole('checkbox', { name: 'Residente de demostración', exact: true }).isChecked(), true);
        await page.getByRole('button', { name: 'Cancelar edición', exact: true }).click();
        assert.equal(await page.getByLabel('Correo electrónico', { exact: true }).count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Care overflow at ${width}`);
        await page.screenshot({ path: path.join(output, `personas-cuidado-${width}.png`), fullPage: true });
        await checkConnections(width);
        await page.getByRole('button', { name: 'Dar acceso a esta persona', exact: true }).click();
        await page.getByText('Ficha a la que corresponde esta cuenta', { exact: true }).waitFor();
        assert.equal(await page.getByRole('radio', { name: 'Residente de demostración', exact: true }).isChecked(), true);
        await checkPeopleControls();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Account overflow at ${width}`);
        await page.evaluate(() => { window.scrollTo(0,0); return new Promise(resolve => requestAnimationFrame(resolve)); });
        await page.screenshot({ path: path.join(output, `personas-cuenta-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Datos de Residente de demostración', exact: true }).click();
        const draftDialog = page.getByRole('alertdialog', {name:'¿Salir de la edición?'});
        await draftDialog.waitFor();
        await page.screenshot({ path: path.join(output, `confirmar-borrador-${width}.png`) });
        assert.equal(await draftDialog.getByRole('button', { name:'Seguir editando' }).evaluate(button => button === document.activeElement), true);
        await page.keyboard.press('Escape');
        await draftDialog.waitFor({state:'detached'});
        assert.equal(await page.getByLabel('Correo electrónico', { exact: true }).isVisible(), true, 'Cancelled navigation preserves the draft');
        await checkTeamDialog();
        await page.getByRole('button', { name: 'Equipo y accesos', exact: true }).click();
        await page.getByText('Cuida a: Residente de demostración', { exact: true }).waitFor();
        assert.equal(await browser.contexts()[0].pages().length, 1);
        continue;
      }
      if (unverified) {
        await page.goto(`${origin}/?unverified=${width}`);
        await page.getByText('Consulta de incidentes sin verificar', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Ver historial (0)', exact: true }).count(), 0);
        await page.locator('nav:visible .preparation-indicator.is-pending').first().waitFor();
        const titles = await page.locator('#incidents-title, #care-location-title').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().top));
        if (width > 1400) assert(Math.abs(titles[0] - titles[1]) < 10, 'Overview headings must align');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: path.join(output, `principal-sin-verificar-${width}.png`), fullPage: true });
        if (independent) {
          assert.equal(await page.locator('.care-connection-notice').count(), 0);
          await page.locator('.incident-unavailable').getByRole('button', { name: 'Revisar preparación' }).click();
        } else {
          await page.getByText('Sesión de esta PC pausada', { exact: true }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Revisar preparación', exact: true }).count(), 0);
          await page.getByRole('button', { name: 'Revisar conexión', exact: true }).click();
        }
        await page.getByRole('heading', { name: 'Preparar la asistencia' }).waitFor();
        assert.equal(await page.locator('#preparation-access').evaluate(node => node === document.activeElement), true);
        await page.getByText(independent ? 'Activa' : 'Pausada', { exact: true }).waitFor();
        await page.screenshot({ path: path.join(output, `preparacion-pendientes-${width}.png`), fullPage: true });
        continue;
      }
      if (home) {
        await page.goto(`${origin}/?home=${width}`);
        await page.getByText(quiet ? 'Ubicación desactualizada' : 'Ubicación reciente recibida', {exact:true}).waitFor();
        const identity=await page.getByRole('heading',{name:'Residente de demostración'}).boundingBox();
        const location=await page.getByRole('heading',{name:'Ubicación y zona'}).boundingBox();
        assert(identity.y<location.y);
        if (quiet) {
          await page.getByText('Sin incidentes pendientes',{exact:false}).waitFor();
          await page.getByText(/Última posición hace 6 h/).waitFor();
          assert.equal(await page.getByText('No se puede confirmar la situación de la zona',{exact:true}).count(),0);
        } else {
          await page.getByText('Salida de geocerca pendiente de atención', {exact:true}).waitFor();
          const alert=await page.getByRole('alert',{name:'Atención pendiente'}).boundingBox();
          assert(identity.y<alert.y);
          if(width<=1100) assert(alert.y<location.y);
          else assert(alert.x<location.x);
        }
        assert.equal(await page.getByText('Sin alertas activas',{exact:true}).count(),0);
        assert.equal(await page.getByRole('button',{name:'Probar alerta de caída'}).count(),0);
        if (!quiet) {
          await page.getByRole('button',{name:'Revisar pendientes'}).click();
          assert.equal(await page.locator('.incident-list').isVisible(),true);
          await page.getByRole('button',{name:'Ocultar detalle de atención'}).click();
          assert.equal(await page.getByRole('alert',{name:'Atención pendiente'}).isVisible(),true);
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.evaluate(()=>document.fonts.ready);
        await page.evaluate(()=>{window.scrollTo(0,0);return new Promise(resolve=>requestAnimationFrame(resolve));});
        await page.screenshot({path:path.join(output,`principal-${quiet ? 'sin-pendientes-' : ''}${width}.png`),fullPage:true});
        await page.getByRole('button',{name:'Red local',exact:true}).click();
        await page.getByRole('button',{name:'Ver mapa y geocerca'}).click();
        assert.equal(await page.getByRole('button',{name:'Red local y geocerca'}).getAttribute('aria-pressed'),'true');
        await page.getByRole('button',{name:/^Panel/}).click();
        assert.equal(await page.getByRole('button',{name:'Red local',exact:true}).getAttribute('aria-pressed'),'true');
        continue;
      }
      await page.goto(`${origin}/?qa=${width}#preparacion`);
      await page.getByRole('heading', { name: 'Preparar la asistencia' }).waitFor();
      if (linked) {
        await page.getByText('Vínculo de este perfil guardado').waitFor();
        assert.equal(await page.getByRole('checkbox').count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Vincular y sincronizar' }).count(), 0);
      } else await page.getByLabel('Correo electrónico').waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Horizontal overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `preparacion-${linked ? 'vinculada-' : ''}${width}.png`), fullPage: true });
      await page.getByRole('button', { name: /Celular y geocerca/ }).click();
      await page.getByRole('button', { name: 'Preparar acceso y vínculo' }).click();
      await page.getByRole('heading', { name: 'Preparar la asistencia' }).waitFor();
      if (linked) await page.getByText('Vínculo de este perfil guardado').waitFor();
      await page.getByRole('button', { name: /Avisos y pruebas/ }).click();
      await page.getByRole('heading', { name: 'Reglas y Canales de Notificación' }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Settings overflow at ${width}`);
      assert.equal(await browser.contexts()[0].pages().length, 1);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: 3 viewports, ${portal ? 'portal people/accounts' : people ? 'local ficha/care/accounts' : 'same-tab setup/map/notifications'}, no overflow, no cloud writes.`);
    console.log(output);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
