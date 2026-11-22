import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
const assets={};
for(const name of readdirSync('web')) assets['/'+name]=readFileSync('web/'+name).toString('base64');
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/index.js','const assets='+JSON.stringify(assets)+';\n'+readFileSync('worker/index.js','utf8'));
