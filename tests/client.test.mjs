import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

test('published assets match source and contain only the server auth client', async()=>{
 for(const file of ['index.html','auth-client.js','cloud-sync.js']) {
  assert.equal(await readFile('public/'+file,'utf8'),await readFile(file,'utf8'));
 }
 const html=await readFile('index.html','utf8');
 assert.doesNotMatch(html,/mw_dahod_users_v1|users\.find\s*\(|loginForm[^\n]*onsubmit/);
 assert.equal([...html.matchAll(/<script src="\/auth-client\.js"><\/script>/g)].length,1);
 for(const [,attributes,source] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  if(!attributes.includes('src=')) new Script(source);
 }
 assert.doesNotMatch(html,/localStorage|persistSaved|restoreSaved|Saved edits stay in this browser/);
 assert.equal([...html.matchAll(/editForm'\)\.addEventListener\('submit'/g)].length,1);
 new Script(await readFile('auth-client.js','utf8'));
 new Script(await readFile('cloud-sync.js','utf8'));
});
