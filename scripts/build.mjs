import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
const assets={};
function include(url,path){assets[url]=readFileSync(path).toString('base64')}
for(const name of readdirSync('web')) include('/'+name,'web/'+name);
include('/index.html','index.html');
include('/demo.html','demo.html');
for(const name of readdirSync('assets'))include('/assets/'+name,'assets/'+name);
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/index.js','const assets='+JSON.stringify(assets)+';\n'+readFileSync('worker/index.js','utf8'));
