// Arena X1 · servidor multiplayer (Node + ws). Serve o jogo e roda os lobbies via WebSocket em /ws
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000;
const HTML=fs.existsSync(path.join(__dirname,'public','index.html'))?path.join(__dirname,'public','index.html'):path.join(__dirname,'index.html');
const KILLS=[5,10,15,20,30,50],MAXP=[2,3,4,6,8],TEAMS=[0,2,3,4]; // índices usados em cfg: k, m, t (map reservado p/ futuros mapas)
const rooms=new Map();let nid=1;
const srv=http.createServer((q,s)=>{
  if(q.url==='/health'){s.writeHead(200);return s.end('ok')}
  fs.readFile(HTML,(e,d)=>{if(e){s.writeHead(500);return s.end('index.html não encontrado')}
    s.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});s.end(d)})});
const wss=new WebSocketServer({server:srv,path:'/ws',maxPayload:16384});
const send=(p,o)=>{if(p.ws.readyState===1)p.ws.send(JSON.stringify(o))};
const all=(r,o,ex)=>{for(const p of r.players.values())if(p!==ex)send(p,o)};
const num=(v,a,b)=>Number.isFinite(v)?Math.min(b,Math.max(a,v)):0;
const nt=r=>TEAMS[r.cfg.t];
const clean=s=>{const o={};if(s&&typeof s==='object')for(const k of Object.keys(s).slice(0,30))if(/^[a-z]{1,6}$/.test(k)&&(typeof s[k]==='number'||typeof s[k]==='boolean'))o[k]=s[k];return o};
function pickTeam(r){const n=nt(r);if(!n)return 0;const c=Array(n).fill(0);for(const p of r.players.values())c[p.team]++;return c.indexOf(Math.min(...c))}
const snap=r=>({t:'room',id:r.id,name:r.name,cfg:r.cfg,host:r.host,state:r.state,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,skin:p.skin}))});
const bc=r=>all(r,snap(r));
function scores(r){const n=nt(r),p={},t=Array(n).fill(0);for(const q of r.players.values()){p[q.id]=q.kills;if(n)t[q.team]+=q.kills}return{p,t}}
function join(r,p){p.room=r;p.team=pickTeam(r);p.kills=p.deaths=0;r.players.set(p.id,p);bc(r)}
function finish(r,win,why){r.state='lobby';all(r,{t:'end',win,why,sc:scores(r)});bc(r)}
function leave(p){const r=p.room;if(!r)return;r.players.delete(p.id);p.room=null;
  if(!r.players.size){rooms.delete(r.id);return}
  if(r.host===p.id)r.host=r.players.keys().next().value;
  if(r.state==='playing'&&r.players.size<2)finish(r,null,'JOGADORES INSUFICIENTES');else bc(r)}
function setP(p,m){p.name=String(m.name||'').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,14)||'Jogador';p.skin=clean(m.skin)}
const err=(p,m)=>send(p,{t:'err',m});
const H=Object.assign(Object.create(null),{
  list(p){send(p,{t:'rooms',rooms:[...rooms.values()].map(r=>({id:r.id,name:r.name,n:r.players.size,max:MAXP[r.cfg.m],k:KILLS[r.cfg.k],t:nt(r),s:r.state}))})},
  create(p,m){leave(p);setP(p,m);let id;do id=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('');while(rooms.has(id));
    const r={id,name:String(m.rname||('Sala de '+p.name)).slice(0,24),cfg:{k:1,m:2,t:0,map:0},host:p.id,state:'lobby',players:new Map()};rooms.set(id,r);join(r,p)},
  join(p,m){const r=rooms.get(m.id);if(!r)return err(p,'Sala não existe mais');if(r.state!=='lobby')return err(p,'Partida em andamento');
    if(r.players.size>=MAXP[r.cfg.m])return err(p,'Sala cheia');leave(p);setP(p,m);join(r,p)},
  cfg(p,m){const r=p.room;if(!r||r.host!==p.id||r.state!=='lobby'||!m.cfg)return;const ot=r.cfg.t;
    for(const[k,n]of[['k',KILLS.length],['m',MAXP.length],['t',TEAMS.length],['map',1]]){const v=m.cfg[k];if(Number.isInteger(v)&&v>=0&&v<n)r.cfg[k]=v}
    if(MAXP[r.cfg.m]<r.players.size)r.cfg.m=MAXP.findIndex(x=>x>=r.players.size);
    if(r.cfg.t!==ot){const n=nt(r);[...r.players.values()].forEach((q,i)=>q.team=n?i%n:0)}bc(r)},
  team(p,m){const r=p.room;if(!r||r.state!=='lobby')return;const n=nt(r);if(n&&Number.isInteger(m.team)&&m.team>=0&&m.team<n){p.team=m.team;bc(r)}},
  start(p){const r=p.room;if(!r||r.host!==p.id||r.state!=='lobby')return;if(r.players.size<2)return err(p,'Precisa de pelo menos 2 jogadores');
    for(const q of r.players.values()){q.kills=q.deaths=0;q.dt=0}r.state='playing';bc(r);all(r,{t:'start'})},
  st(p,m){const r=p.room;if(r&&r.state==='playing'&&m.s)all(r,{t:'st',id:p.id,s:m.s},p)},
  fire(p,m){const r=p.room;if(r&&r.state==='playing')all(r,{t:'fire',id:p.id,o:m.o,e:m.e,w:m.w},p)},
  dmg(p,m){const r=p.room;if(!r||r.state!=='playing')return;const v=r.players.get(m.to);if(!v||v===p)return;
    if(nt(r)&&v.team===p.team)return; // sem fogo amigo
    send(v,{t:'dmg',from:p.id,d:num(m.d,0,999),gib:!!m.gib})},
  died(p,m){const r=p.room;if(!r||r.state!=='playing')return;const n=Date.now();if(n-p.dt<1500)return;p.dt=n;p.deaths++;
    const k=r.players.get(m.by),tm=nt(r);let kid=0;if(k&&k!==p&&!(tm&&k.team===p.team)){k.kills++;kid=k.id}
    const sc=scores(r);all(r,{t:'kill',k:kid,v:p.id,gib:!!m.gib,sc});const lim=KILLS[r.cfg.k];
    if(tm){const i=sc.t.findIndex(v=>v>=lim);if(i>=0)finish(r,{team:i})}else if(kid&&k.kills>=lim)finish(r,{id:kid})},
  leave(p){leave(p)}
});
wss.on('connection',ws=>{
  const p={id:nid++,ws,name:'Jogador',skin:{},room:null,team:0,kills:0,deaths:0,dt:0,tk:0,c:0};ws.alive=true;send(p,{t:'me',id:p.id});
  ws.on('pong',()=>ws.alive=true);
  ws.on('message',d=>{let m;try{m=JSON.parse(d)}catch{return}if(!m||typeof m.t!=='string'||!H[m.t])return;
    const n=Date.now();if(n-p.tk>1000){p.tk=n;p.c=0}if(++p.c>200)return;H[m.t](p,m)});
  ws.on('close',()=>leave(p));ws.on('error',()=>{})});
setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue}ws.alive=false;ws.ping()}},25000);
srv.listen(PORT,()=>console.log('Arena X1 na porta '+PORT));
