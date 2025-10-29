/* server/index.js - CyWeb mediator server (Node/Express)
   Deploy on Render. Set env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
*/
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;

if(!OWNER || !REPO || !TOKEN){
  console.error('Missing GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN env vars');
  process.exit(1);
}

const app = express();
app.use(bodyParser.json({limit:'1mb'}));
app.use((req,res,next)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.sendStatus(200);
  next();
});

async function getFileSha(path){
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  const r = await fetch(url, {headers:{Authorization:`token ${TOKEN}`, 'User-Agent':'CyWeb-Mediator'}});
  if(r.status===200){
    const j = await r.json();
    return j.sha;
  }
  return null;
}

app.post('/api/create-repo', async (req,res)=>{
  try{
    const payload = req.body;
    if(!payload || !payload.repo_name) return res.status(400).json({error:'repo_name required'});
    const safeName = payload.repo_name.replace(/[^a-zA-Z0-9-_]/g,'-').toLowerCase();
    const path = `CyWeb/Repos/${safeName}.json`;
    const content = Buffer.from(JSON.stringify(payload,null,2)).toString('base64');
    const sha = await getFileSha(path);
    const commitMessage = sha ? `Update repo ${safeName}` : `Create repo ${safeName}`;
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
    const body = { message: commitMessage, content: content, committer:{name:'CyWeb Bot', email:'cyweb-bot@users.noreply.github.com'}};
    if(sha) body.sha = sha;
    const r = await fetch(url, {method:'PUT', headers:{Authorization:`token ${TOKEN}`, 'User-Agent':'CyWeb-Mediator', 'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const jr = await r.json();
    if(!r.ok) return res.status(r.status).json({error:'GitHub API error', details: jr});
    return res.json({ok:true, content: jr.content, commit: jr.commit});
  }catch(err){
    console.error(err);
    return res.status(500).json({error:'server error', details: String(err)});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server listening on', PORT));
