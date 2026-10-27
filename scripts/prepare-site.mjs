import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public',{recursive:true});
await Promise.all(['index.html','auth-client.js'].map(name=>copyFile(name,'public/'+name)));
