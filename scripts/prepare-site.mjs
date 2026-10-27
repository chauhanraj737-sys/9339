import {mkdir,copyFile,readFile} from 'node:fs/promises';
// Never publish a competing browser-only account implementation.
const html=await readFile('index.html','utf8');
if (/mw_dahod_users_v1|users\.find\s*\(/.test(html)) {
 throw new Error('Legacy local authentication must be removed before publishing.');
}
await mkdir('public',{recursive:true});
await Promise.all(['index.html','auth-client.js','cloud-sync.js'].map(name=>copyFile(name,'public/'+name)));
