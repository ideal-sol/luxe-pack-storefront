// Source Browser Acceptance: run against an isolated optimized Next build.
// Supply Playwright/Chromium and the independently downloaded official SDK paths
// through PAYMENT_BROWSER_* variables. Every API/provider request is synthetic.
// No shared Preview, real credentials, real transaction or production activation.
const { chromium } = await import(process.env.PAYMENT_BROWSER_PLAYWRIGHT ?? 'playwright');
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root=fileURLToPath(new URL('../..', import.meta.url));
const origin=process.env.PAYMENT_BROWSER_ORIGIN ?? 'http://127.0.0.1:3287';
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Use only a task-owned loopback Next start');
const report=process.env.PAYMENT_BROWSER_REPORT ?? '/tmp/SF-PAY192-browser-results.json';
const univa=fs.readFileSync(process.env.PAYMENT_BROWSER_UNIVAPAY_SCRIPT);
const paidy=fs.readFileSync(process.env.PAYMENT_BROWSER_PAIDY_SCRIPT);
const syntheticAppId=[{alg:'HS256',typ:'JWT'},{store_id:'00000000-0000-4000-8000-000000000001',storeId:'00000000-0000-4000-8000-000000000001',mode:'test',exp:4000000000}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.c3ludGhldGlj';
// Provider document doubles exercise the downloaded SDK's PUBLIC create/open/
// update/submit and configure/launch. No private SDK object is read or invoked.
// Their synthetic messages are NOT evidence of merchant or real 3DS acceptance.
const inlineHtml=`<!doctype html><title>Synthetic UnivaPay frame</title>
<label>Fixture input state <input id="state" value="valid"></label><p id="error"></p>
<script>
let id;function send(type,data={},errors){parent.postMessage(JSON.stringify({type,data:{...data,connectorId:id},...(errors?{errors}: {})}),'${origin}');}
addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(e.origin!=='${origin}')return;
if(m.type==='handshake'){id=m.data.connectorId;send('handshake',{paired:true});}
if(m.type==='execute'){window.options=m.data.params;send('opened');send('resize',{height:120});}
if(m.type==='update-parameters'){window.update=m.data;send('parameters-updated');}
if(m.type==='submit-card-data'){
window.submits=(window.submits||0)+1;
if(document.querySelector('#state').value==='invalid'){document.querySelector('#error').textContent='Synthetic provider validation error';send('submitted',{}, {code:400,message:'VALIDATION_ERROR'});}
else if(document.querySelector('#state').value==='3ds'){send('three-ds-authorization');send('three-ds-authorization-modal',{url:'https://provider.example/synthetic-3ds'});}
else send('submitted',{token:'synthetic-token',charge:'unverified-raw-charge',status:'success'});
}});
send('handshake',{connectorId:'synthetic-handshake',paired:false});
</script>`;
const paidyHtml=`<!doctype html><title>Synthetic Paidy checkout</title><button id="authorize">Fixture authorize</button><button id="reject">Fixture reject</button><button id="close">Fixture close</button>
<script>let id;addEventListener('message',e=>{if(e.origin!=='${origin}'||e.data.event!=='paidy_checkout:init')return; id=e.data._id;window.payload=JSON.parse(e.data.payload);document.querySelector('#authorize').focus();});
window.reply=(status)=>{const message={_id:id,event:'paidy_checkout:close',payload:{status,id:'pay_synthetic_payment'}};parent.postMessage(message,'${origin}');parent.postMessage(message,'${origin}');};
document.querySelector('#authorize').onclick=()=>reply('authorized');document.querySelector('#reject').onclick=()=>reply('rejected');document.querySelector('#close').onclick=()=>reply('closed');</script>`;
(async()=>{
 const f=await import(root+'/node_modules/@oripa/storefront-testkit/dist/index.js');
 const product=f.PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0];
 const browser=await chromium.launch({executablePath:process.env.PAYMENT_BROWSER_CHROMIUM,headless:true,args:['--no-sandbox']});
 const results=fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')).results : [];
 const scenarios=process.env.PAYMENT_BROWSER_SCENARIOS?.split(',')||['methods','univa_unknown','univa_invalid','univa_3ds_unmount','univa_script_error','paidy_authorized','paidy_rejected','paidy_logout','paidy_navigation','paidy_unmount','paidy_history','netridecash','fincode_saved_3ds','methods_error'];
 try {
  for(const scenario of scenarios) {
   const context=await browser.newContext(); const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
   await context.addCookies([{name:'XSRF-TOKEN',value:'e'.repeat(64),url:origin}]);
   const mutations=[]; const errors=[];let techcoin=null,authenticated=true,member='original',documents=0,finishLogout;
   page.on('pageerror',e=>errors.push(e.message));
   page.on('framenavigated',frame=>{if(frame===page.mainFrame())documents++;});
   await page.addInitScript(()=>{window.__documentIdentity=crypto.randomUUID();});
   const id='0198a001-0000-7000-8000-000000000098';
   const fincode=scenario.startsWith('fincode');
   let method=scenario.startsWith('paidy')?'paidy':scenario==='netridecash'?'netridecash':'credit_card';
   const options=[
    {method:'credit_card',label:'クレジットカード',flow:fincode?'card_component':'inline_card_form',saved_cards_enabled:fincode,available:true,unavailable_reason:null,inline_form:{provider:'univapay',script_url:'https://widget.univapay.com/client/checkout.js',options:{appId:syntheticAppId,checkout:'payment',amount:product.price.amount,currency:'jpy',tokenType:'one_time',capture:true,inline:true,locale:'ja',email:'synthetic@example.test',showCvv:true}}},
    {method:'netridecash',label:'電子マネー（NetRideCash）',flow:'redirect',saved_cards_enabled:false,available:true,unavailable_reason:null},
    {method:'paidy',label:'あと払い（ペイディ）',flow:'paidy_checkout',saved_cards_enabled:false,available:true,unavailable_reason:null},
    {method:'paypay',label:'PayPay',flow:'redirect',saved_cards_enabled:false,available:false,unavailable_reason:'provider_unavailable'},
   ];
   function payment(){return {id,point_product_id:product.id,method,method_label:options.find(x=>x.method===method).label,status:'requires_action',amount:product.price,grant:{paid_points:1000,bonus_points:0,limited_bonus_points:0,total_points:1000},created_at:'2026-10-28T00:00:00Z',expires_at:null,succeeded_at:null,next_action: method==='netridecash'?{...f.PAYMENT_FOUNDATION_FIXTURES.form_post,fields:f.PAYMENT_FOUNDATION_FIXTURES.form_post.fields.map(x=>x.name==='price'?{...x,value:String(product.price.amount)}:x)}:method==='paidy'?{...f.PAYMENT_FOUNDATION_FIXTURES.paidy_checkout,payload:{...f.PAYMENT_FOUNDATION_FIXTURES.paidy_checkout.payload,amount:product.price.amount,order:{...f.PAYMENT_FOUNDATION_FIXTURES.paidy_checkout.payload.order,order_ref:id,items:[{id:product.id,title:'Synthetic coins',quantity:1,unit_price:product.price.amount}]}}}:fincode?{type:'three_d_secure',url:'https://provider.example/synthetic-3ds'}:{type:'univapay_inline',amount:product.price.amount,update:{email:'synthetic@example.test',metadata:{'oripa-payment-id':id,'oripa-member':'synthetic-member'}},success_url:origin+'/points/purchase/thanks?pid='+id}};}
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===origin&&url.pathname.startsWith('/api/v2/')) {
     const path=url.pathname.slice('/api/v2'.length);let body;
     if(req.method()!=='GET')mutations.push({path,method:req.method(),body:req.postData(),headers:req.headers()});
     if(path==='/auth/session')body=authenticated?{...f.PUBLIC_AUTH_FIXTURE.authenticated_session,user:{...f.PUBLIC_AUTH_FIXTURE.authenticated_session.user,id:member==='original'?f.PUBLIC_AUTH_FIXTURE.authenticated_session.user.id:'synthetic-member-2'}}:{authenticated:false,user:null};
     else if(path==='/auth/logout'){await new Promise(r=>{finishLogout=r;});authenticated=false;return route.fulfill({status:204});}
     else if(path==='/me/sms-verification')body={verified:true,phone:null,phone_masked:null,verified_at:null,challenge:null};
     else if(path==='/point-products')body={...f.PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible,data:[product]};
     else if(path==='/me/wallet')body=f.PUBLIC_POINT_BALANCE_FIXTURES.positive;
     else if(path==='/payment-methods'){
      if(scenario==='methods_error')return route.fulfill({status:503,contentType:'application/problem+json',body:JSON.stringify({type:'about:blank',title:'Unavailable',status:503,code:'SERVICE_UNAVAILABLE'})});
      body={data:options};
     }
     else if(path==='/me/payment-cards')body={data:[{id:'card_synthetic_47',brand:'VISA',last4:'4242',expiration:{month:12,year:2030},is_expired:false,can_pay:true,last_used_at:null,verification_status:'verified'}],limits:{maximum:3,remaining:2,registration_remaining:2,next_capacity_at:null}};
     else if(path==='/me/payment-card-ui-bootstrap')body=f.PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox;
     else if(path.endsWith('/client-events'))return route.fulfill({status:204});
     else if(path==='/payments'||path===`/payments/${id}`||path.endsWith('/paidy-authorizations'))body=payment();
     else body={data:[]};
     return route.fulfill({status:path==='/payments'&&req.method()==='POST'?201:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    if(req.url()==='https://widget.univapay.com/client/checkout.js')return scenario==='univa_script_error'?route.abort():route.fulfill({contentType:'application/javascript',body:univa});
    if(req.url()==='https://apps.paidy.com/')return route.fulfill({contentType:'application/javascript',body:paidy});
    if(url.origin==='https://widget.univapay.com'&&url.pathname==='/checkout/index.html')return route.fulfill({contentType:'text/html',body:inlineHtml});
    if(url.origin==='https://widget.univapay.com'&&url.pathname==='/redirect/index.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic 3DS wrapper</title><button autofocus>Fixture 3DS</button><script>parent.postMessage({type:"THREE_DS_WRAPPER_INITIALIZATION_OPENED"},"'+origin+'");addEventListener("message",e=>{if(e.data.type==="THREE_DS_WRAPPER_INITIALIZATION")parent.postMessage({type:"THREE_DS_MODAL_OPENED"},"'+origin+'")})</script>'});
    if(url.origin==='https://checkout-v2.paidy.com')return route.fulfill({contentType:'text/html',body:paidyHtml});
    if(url.origin==='https://secure.tc-site.com'){techcoin={method:req.method(),body:req.postData()};return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Mock Techcoin POST received</title>'});}
    if(url.origin==='https://provider.example')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Mock fincode 3DS destination</title>'});
    if(url.origin===origin)return route.continue();
    return route.fulfill({status:200,contentType:url.pathname.endsWith('.js')?'application/javascript':'image/svg+xml',body:url.pathname.endsWith('.js')?'':'<svg xmlns="http://www.w3.org/2000/svg"/>'});
   });
   const route=origin+'/points/purchase/'+product.id;
   await page.goto(route+'?payment_method='+method);
   if(scenario==='methods_error'){
    await page.getByRole('button',{name:'再読み込み'}).waitFor();
    assert.equal(await page.getByRole('radio').count(),0);
   }else{
    await page.getByRole('radio',{name:'電子マネー（NetRideCash）',exact:true}).waitFor();
    assert.equal(await page.getByRole('radio',{name:'PayPay',exact:true}).isDisabled(),true);
    const initial=await page.evaluate(()=>window.__documentIdentity);
    if(scenario==='methods'){
     await page.frameLocator('iframe[title="UnivaPay カード入力"]').getByLabel('Fixture input state').waitFor();
     await page.getByRole('radio',{name:'あと払い（ペイディ）',exact:true}).click();
     await page.waitForURL('**payment_method=paidy');
     await page.getByRole('radio',{name:'あと払い（ペイディ）',exact:true}).waitFor();
     assert.notEqual(await page.evaluate(()=>window.__documentIdentity),initial);
     assert.equal(await page.locator('iframe').count(),0);
     assert.equal(await page.getByRole('radio',{name:'あと払い（ペイディ）',exact:true}).isChecked(),true);
    }else if(scenario==='univa_script_error'){
     await page.getByRole('alert').filter({hasText:'この決済方法は現在ご利用いただけません'}).waitFor();
     assert.equal(await page.getByRole('button',{name:'購入する',exact:true}).isDisabled(),true);
    }else{
     if(fincode){await page.getByRole('radio',{name:'クレジットカード',exact:true}).click();await page.getByText(/VISA •••• 4242/).waitFor();}
     if(scenario.startsWith('univa_')){
      const input=page.frameLocator('iframe[title="UnivaPay カード入力"]').getByLabel('Fixture input state');await input.waitFor();
      if(scenario==='univa_invalid')await input.fill('invalid');
      if(scenario==='univa_3ds_unmount')await input.fill('3ds');
     }
     await page.getByRole('button',{name:'購入する',exact:true}).click();
     if(scenario.startsWith('paidy')){
      const overlay=page.frameLocator('iframe[src^="https://checkout-v2.paidy.com"]');
      await overlay.getByRole('button',{name:'Fixture authorize'}).waitFor();
      if(scenario==='paidy_authorized'){
       assert.equal(await overlay.locator('body').evaluate(()=>document.activeElement.textContent),'Fixture authorize');
       await overlay.getByRole('button',{name:'Fixture authorize'}).click();
       await page.waitForURL('**/points/purchase/thanks?pid=*');
       assert.equal(mutations.filter(x=>x.path.endsWith('/paidy-authorizations')).length,1);
      }else if(scenario==='paidy_rejected'){
       await overlay.getByRole('button',{name:'Fixture reject'}).click();
       await page.waitForFunction(old=>window.__documentIdentity!==old,initial);
      }else if(scenario==='paidy_logout'){
       await Promise.all([page.waitForRequest(r=>r.url().endsWith('/auth/logout')),page.getByRole('button',{name:'ログアウト',exact:true}).first().evaluate(button=>button.click())]);
       await overlay.locator('body').evaluate(()=>window.reply('authorized'));
       await page.waitForTimeout(50);
       assert.equal(mutations.filter(x=>x.path.endsWith('/paidy-authorizations')).length,0);
       assert.equal(await page.evaluate(()=>window.__documentIdentity),initial);
       finishLogout();
       await page.waitForFunction(old=>window.__documentIdentity!==old,initial);
       assert.equal(authenticated,false);
       assert.equal(mutations.filter(x=>x.path==='/auth/logout').length,1);
      }else if(scenario==='paidy_navigation'){
       await page.getByRole('link',{name:'← コイン購入へ戻る'}).evaluate(link=>link.click());
       await page.waitForURL(origin+'/points');
      }else if(scenario==='paidy_history'){
       await page.evaluate(()=>{history.pushState(null,'','/points');dispatchEvent(new PopStateEvent('popstate'));});
       await page.waitForFunction(old=>window.__documentIdentity!==old,initial);
      }else{
       member='different';
       await page.evaluate(()=>dispatchEvent(new CustomEvent('storefront:session-access-rejected',{detail:'SESSION_EXPIRED'})));
       await page.waitForFunction(old=>window.__documentIdentity!==old,initial);
      }
      assert.notEqual(await page.evaluate(()=>window.__documentIdentity),initial);
      assert.equal(await page.locator('iframe[src^="https://checkout-v2.paidy.com"]').count(),0);
      assert.equal(await page.evaluate(()=>typeof window.Paidy),'undefined');
      assert.equal(mutations.filter(x=>x.path.endsWith('/paidy-authorizations')).length,scenario==='paidy_authorized'?1:0);
     }else if(scenario==='netridecash'){
      await page.waitForURL('https://secure.tc-site.com/access');assert.equal(techcoin.method,'POST');
      assert.deepEqual([...new URLSearchParams(techcoin.body).keys()],['clientip','payment_code','cookie','price','sendid','email']);
     }else if(fincode)await page.waitForURL('https://provider.example/synthetic-3ds');
     else if(scenario==='univa_3ds_unmount'){
      await page.frameLocator('iframe[name="three-ds-i-frame-client-wrapper"]').getByRole('button',{name:'Fixture 3DS'}).waitFor();
      await page.evaluate(()=>dispatchEvent(new CustomEvent('storefront:session-access-rejected',{detail:'SESSION_EXPIRED'})));
      await page.waitForFunction(old=>window.__documentIdentity!==old,initial);
      assert.equal(await page.locator('iframe[name="three-ds-i-frame-client-wrapper"]').count(),0);
     }else{
      await page.waitForURL('**/points/purchase/thanks?pid=*');
      assert.equal(mutations.filter(x=>x.path.includes('/univapay')).length,0);
     }
     const starts=mutations.filter(x=>x.path==='/payments');assert.equal(starts.length,1);
     const input=JSON.parse(starts[0].body);assert.equal(input.point_product_id,product.id);assert.equal(starts[0].headers['x-oripa-client-version'],'2.0.0-alpha.47');assert.ok(starts[0].headers['idempotency-key']);assert.ok(starts[0].headers['x-xsrf-token']);
    }
   }
   assert.deepEqual(errors,[]);
   const previous=results.findIndex(result=>result.scenario===scenario);
   if(previous!==-1)results.splice(previous,1);
   results.push({scenario,status:'PASS',document_navigations:documents,starts:mutations.filter(x=>x.path==='/payments').length,confirmations:mutations.filter(x=>x.path.endsWith('/paidy-authorizations')).length});
   fs.writeFileSync(report,JSON.stringify({kind:'isolated next start / canonical alpha47 Client / downloaded SDKs / synthetic API and provider frames, not real provider acceptance',sdk_sha256:{univapay:crypto.createHash('sha256').update(univa).digest('hex'),paidy:crypto.createHash('sha256').update(paidy).digest('hex')},results},null,2)+'\n');
   console.log(JSON.stringify(results.at(-1)));await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
