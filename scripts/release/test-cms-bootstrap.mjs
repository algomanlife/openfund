import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const mode=process.argv[2];
const base=process.env.DIRECTUS_URL;
const database=process.env.DATABASE_URL;
if(!['before','after'].includes(mode) || !base || !database ||
   !['localhost','127.0.0.1'].includes(new URL(base).hostname) ||
   !/(?:^|[_-])ci(?:$|[_-])/.test(new URL(database).pathname.slice(1)))
  throw Error('CMS bootstrap test requires a local disposable CI database and Directus URL.');
const statePath='/tmp/openfund-cms-bootstrap-state.json';
async function request(method,path,token,body){
 const response=await fetch(new URL(path,base),{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`${method} ${path.split('?')[0]} returned ${response.status}: ${(await response.text()).slice(0,200)}`);
 return response.status===204?null:response.json();
}
const login=await request('POST','/auth/login',null,{email:process.env.DIRECTUS_ADMIN_EMAIL,password:process.env.DIRECTUS_ADMIN_PASSWORD});
const token=login.data.access_token;
const all=async collection=>(await request('GET',`/items/${collection}?fields=id&limit=-1`,token)).data;
const publicTranslations=async ()=>(await request('GET','/items/ui_messages?fields=key,namespace,translations.language_code,translations.value&filter[status][_eq]=published&limit=1')).data;
const home=async ()=>(await request('GET','/items/home_content?fields=id,status,translations.language_code,translations.headline')).data;
const bilingual=row=>['fa','en'].every(lang=>row?.translations?.some(t=>t.language_code===lang));
assert.ok(bilingual((await publicTranslations())[0]),'public UI message must expose fa/en translations');
assert.ok(bilingual(await home()),'public Home singleton must expose fa/en translations');
for(const collection of ['faq_categories','faqs','learning_paths','lessons','glossary_terms','tools','referral_content']){
 const response=await request('GET',`/items/${collection}?limit=1`);
 assert.ok((Array.isArray(response.data)?response.data:[response.data]).length,'missing website content: '+collection);
}
if(mode==='before'){
 const messages=(await request('GET','/items/ui_messages?fields=id,key,translations.id,translations.language_code,translations.value&filter[status][_eq]=published&limit=1',token)).data;
 const selected=messages[0].translations.find(t=>t.language_code==='en');
 assert.ok(selected?.id,'seeded English UI translation missing');
 const edited=selected.value+' [CI preserved edit]';
 await request('PATCH',`/items/ui_message_translations/${selected.id}`,token,{value:edited});
 const marker='v041-private-draft-'+crypto.randomUUID();
 const draft=await request('POST','/items/ui_messages',token,{key:marker,namespace:'terminal',status:'draft',translations:[{language_code:'en',value:marker}]});
 fs.writeFileSync(statePath,JSON.stringify({selectedId:selected.id,original:selected.value,edited,draftId:draft.data.id,marker,count:(await all('ui_messages')).length}));
 console.log('CMS first-run baseline, published bilingual reads and disposable editorial edit recorded.');
}else{
 const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
 assert.equal((await all('ui_messages')).length,state.count,'rerun created duplicate UI messages');
 const selected=(await request('GET',`/items/ui_message_translations/${state.selectedId}`,token)).data;
 assert.equal(selected.value,state.edited,'rerun overwrote an administrator edit');
 const query=new URLSearchParams({'filter[value][_eq]':state.marker,fields:'id,language_code,value','limit':'-1'});
 const visible=(await request('GET',`/items/ui_message_translations?${query}`)).data;
 assert.equal(visible.length,0,'draft translation leaked through public child endpoint');
 await request('PATCH',`/items/ui_message_translations/${state.selectedId}`,token,{value:state.original});
 await request('DELETE',`/items/ui_messages/${state.draftId}`,token);
 fs.rmSync(statePath,{force:true});
 console.log('CMS rerun preserved editorial edit, kept record count and hid draft translation.');
}
