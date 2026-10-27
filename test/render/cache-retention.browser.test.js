// Opt-in integration: real 20-player room, reconnect, teammate scouting and active-battle spectator switches.
// RENDER_E2E=1 CHROME_PATH=<Chrome> node --test test/render/cache-retention.browser.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { Client, sleep, CHROME, ROOT } from '../e2e/client.mjs';
const enabled = process.env.RENDER_E2E === '1' && fs.existsSync(CHROME)
  && fs.existsSync(new URL('../../plugins/local-outfits-a/plugin.lock.json', import.meta.url));
test('20-player reconnect, teammate and battle-observer switches retain original and outfit models', {
  skip: !enabled && 'requires Chrome, installed art/outfits and RENDER_E2E=1', timeout: 300000,
}, async () => {
  const P = (await import('puppeteer-core')).default;
  const serverEnv = { ...process.env };
  delete serverEnv.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath,['test/e2e/fastServer.mjs'],{cwd:ROOT,env:{...serverEnv,PORT:'0',HOST:'127.0.0.1',SP_START_ROUND:'1',SP_START_KIT:'1',SP_START_CHESS:'chess_char_1_01_a',SP_BOT_CHESS:'chess_char_1_02_a',SP_AUTO_PLACE:'1',SP_STAGE:'act2autochess_m01',SP_TIMER_SCALE:'1',SP_COMBAT_SPEED:'0.25'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const until=Date.now()+180000;
  while(!/fast server on (http:\/\/[^ ]+)/.test(logs)){if(child.exitCode!=null||Date.now()>until){child.kill();throw new Error(logs||'Server start timeout');}await sleep(250);}
  const base=/fast server on (http:\/\/[^ ]+)/.exec(logs)[1];
  const srv={base,stop:async()=>{child.kill();}};
  console.log('Fast server ready',base);

  const launcher = { launch: async o => {
    const browser = await P.launch({ ...o, args: [...o.args, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    for (const page of await browser.pages()) await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
    });
    return browser;
  } };
  const c = new Client(launcher, srv.base, 'cache', {w:1280,h:720});
  const result = {};
  try {
    await c.open('?board=3d'); await c.enter('缓存复用验收');
    const send = (t, args={}) => c.page.evaluate(([t,args]) => globalThis.__SP__.net.request(t,args),[t,args]);
    await send('room.create',{mode:'coop',difficulty:'NORMAL',capacity:20});
    for(let i=1;i<20;i++) await send('room.addBot');
    await send('room.start');
    await c.page.waitForFunction(()=>globalThis.__SP__.store.get().match.public?.phase==='INFO_CHECK');
    await send('g.infoReady',{setupRevision:0});
    await c.page.waitForFunction(()=>globalThis.__SP__.store.get().match.public?.phase==='BAND_DRAFT');
    await send('g.band',{bandId:'band_bldsk'});
    await c.page.waitForFunction(()=>globalThis.__SP__.store.get().match.public?.phase==='PREP',{timeout:90000});
    await c.page.waitForFunction(()=>globalThis.__SP_VIEW__?.kind==='engine'&&[...globalThis.__SP_VIEW__.raw.debug.views.values()].some(v=>v.spineReady),{timeout:60000});
    console.log('Twenty-player prep and renderer ready');
    const ids=await c.page.evaluate(()=>{const s=globalThis.__SP__.store.get();return {mine:s.me.playerId,bot:s.match.public.players.find(p=>p.isBot).playerId}});
    await send('g.watch',{fieldId:'n:'+ids.bot,playerId:ids.bot});
    await c.page.waitForFunction(id=>globalThis.__SP__.store.get().match.field?.fieldId==='n:'+id,{},ids.bot);
    await sleep(2000);
    await send('g.watch',{fieldId:'n:'+ids.mine,playerId:ids.mine});
    await sleep(2000);
    await c.page.evaluate(async()=>{
      const {assets}=await import('/js/assets.js');
      const entries=['char_498_inside','char_199_yak'].map(id=>assets.spineEntry(id));
      const skinId=Object.keys(globalThis.__SP__.data.get('assets').chars.char_498_inside.skins)[0];
      entries.push(assets.spineEntry('char_498_inside',{skin:skinId}));
      const models=await Promise.all(entries.map(e=>assets.spine.acquire(e)));
      entries.forEach(e=>assets.spine.release(e));
      globalThis.__cacheProbe={entries,models};
    });
    const requests=[];
    c.page.on('request',req=>{if(/\.(skel|atlas)(\?|$)/.test(req.url()))requests.push(req.url())});
    await c.page.evaluate(()=>globalThis.__SP__.net.reconnectNow());
    await c.page.waitForFunction(()=>globalThis.__SP__.store.get().connection.status==='online');
    await sleep(21000);
    await send('g.watch',{fieldId:'n:'+ids.bot,playerId:ids.bot}); await sleep(1500);
    await send('g.watch',{fieldId:'n:'+ids.mine,playerId:ids.mine}); await sleep(1500);
    result.reuse=await c.page.evaluate(async()=>{
      const {assets}=await import('/js/assets.js');const p=globalThis.__cacheProbe;
      const values=await Promise.all(p.entries.map(e=>assets.spine.acquire(e)));
      const reused=values.every((v,i)=>v===p.models[i]);p.entries.forEach(e=>assets.spine.release(e));
      return {reused,skels:p.entries.map(e=>e.skel),policy:{max:assets.spine.cache.max,idleBytes:assets.spine.cache.maxIdleWeight,quietBytes:assets.spine.cache.quietWeight},stats:assets.spine.stats()};
    });
    assert.equal(result.reuse.reused,true);
    result.modelReloadRequests=requests.filter(url=>result.reuse.skels.some(s=>url.endsWith(s)));
    assert.deepEqual(result.modelReloadRequests,[]);
    result.players=20;result.reconnect=true;result.teammateSwitch=true;
    // Re-mounting the actual field view must keep the same shared model store.
    result.remount=await c.page.evaluate(async()=>{
      const {mountFieldView}=await import('/js/ui/fieldHost.js');
      const host=document.createElement('div');host.style.cssText='position:fixed;width:640px;height:360px;left:0;top:0';document.body.append(host);
      const view=await mountFieldView(host);const kind=view.kind;view.destroy();host.remove();return kind;
    });
    assert.equal(result.remount,'engine');
    result.rendered=await c.page.evaluate(()=>{
      const views=[...globalThis.__SP_VIEW__.raw.debug.views.values()].filter(v=>v.spineReady);
      let invalidTextures=0;
      for(const view of views) for(const slot of view.actor?.spine?.skeleton?.slots || []) {
        const tex=(slot.currentSprite||slot.currentMesh)?.texture;
        if(tex&&(!tex.valid||tex.destroyed||!tex.baseTexture?.valid||tex.baseTexture.destroyed))invalidTextures++;
      }
      return {models:views.length,invalidTextures};
    });
    assert.ok(result.rendered.models>0);assert.equal(result.rendered.invalidTextures,0);
    // Actual spectator battle switching, using a separately connected spectator seat.
    const observer=new Client(launcher,srv.base,'observer',{w:1280,h:720});
    try {
      await observer.open('?board=3d');await observer.enter('观战缓存验收');
      const code=await c.page.evaluate(()=>globalThis.__SP__.store.get().room.code);
      await observer.page.evaluate(code=>globalThis.__SP__.net.request('room.spectate',{code}),code);
      await sleep(4000);
      await send('g.ready',{ready:true});
      await c.page.waitForFunction(()=>globalThis.__SP__.store.get().match.public.fields?.length>=2,{timeout:60000});
      const fields=await c.page.evaluate(()=>globalThis.__SP__.store.get().match.public.fields.slice(0,2).map(f=>f.fieldId));
      const watch=async id=>{
        for(let retry=0;;retry++){try{await observer.page.evaluate(id=>globalThis.__SP__.net.request('g.watch',{fieldId:id}),id);break;}catch(e){if(e.code!=='RATE'||retry>=4)throw e;await sleep(1000);}}
        await observer.page.waitForFunction(id=>globalThis.__SP__.store.get().match.field?.fieldId===id,{},id);
        await sleep(3000);
      };
      await watch(fields[0]);await watch(fields[1]);await watch(fields[0]);
      const baseline=[];observer.page.on('request',r=>{if(/\/spine\/op\/.*\.(skel|atlas)(\?|$)/.test(r.url()))baseline.push(r.url())});
      await watch(fields[1]);await watch(fields[0]);
      result.battleSpectating={fields,repeatModelRequests:baseline};
      assert.deepEqual(baseline,[]);
      assert.equal(await observer.page.evaluate(()=>globalThis.__SP_VIEW__.kind),'engine');
      result.observerErrors=observer.problems;
    } finally {
      await observer.page?.evaluate(()=>globalThis.__SP__?.net.request('room.leave',{})).catch(()=>{});
      await observer.close();
    }
    result.errors=c.problems;
    fs.mkdirSync('.cache/20p-port', { recursive: true });
    fs.writeFileSync('.cache/20p-port/cache-browser-result.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } catch(error) {
    console.log('DIAGNOSTIC',JSON.stringify({problems:c.problems,state:await c.page?.evaluate(()=>({kind:globalThis.__SP_VIEW__?.kind,stats:globalThis.__SP_VIEW__?.raw?.stats?.(),phase:globalThis.__SP__?.store.get().match.public?.phase,priv:globalThis.__SP__?.store.get().match.private?.board})).catch(()=>null)}));
    throw error;
  } finally {
    await c.page?.evaluate(()=>globalThis.__SP__?.net.request('room.leave',{})).catch(()=>{});
    await c.close(); await srv.stop();
  }
});
