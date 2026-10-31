const root = document.getElementById("app");
const STORE_KEY = "what-if-studio.projects.v1";
const DEMO_CODE = [
"function renderFrame({ ctx, time, duration, width, height, assets }) {",
"  const t = time;",
"  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);",
"  const bg = ctx.createLinearGradient(0, 0, width, height);",
"  bg.addColorStop(0, '#07101e'); bg.addColorStop(.55, '#11192d'); bg.addColorStop(1, '#07090f');",
"  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);",
"  const pulse = .5 + Math.sin(t * 1.7) * .5;",
"  for (let i = 0; i < 7; i++) { const r = 95 + i * 39 + pulse * 8; ctx.beginPath(); ctx.arc(width*.5,height*.39,r,0,Math.PI*2); ctx.strokeStyle='rgba(104,153,255,'+(.19-i*.018)+')'; ctx.lineWidth=1.2; ctx.stroke(); }",
"  const glow=ctx.createRadialGradient(width*.5,height*.39,4,width*.5,height*.39,390); glow.addColorStop(0,'rgba(69,123,245,.35)'); glow.addColorStop(1,'rgba(69,123,245,0)'); ctx.fillStyle=glow; ctx.fillRect(0,0,width,height);",
"  const intro=ease(t/1.1); ctx.save(); ctx.translate(0,(1-intro)*35); ctx.globalAlpha=intro; ctx.textAlign='center';",
"  ctx.fillStyle='#91b4ff'; ctx.font='500 18px Arial'; ctx.fillText('WHAT IF / EPISODE 01',width/2,height*.18);",
"  ctx.fillStyle='#f4f6fc'; ctx.font='700 74px Arial'; ctx.fillText('E SE...',width/2,height*.49);",
"  ctx.fillStyle='rgba(230,238,255,.82)'; ctx.font='400 25px Arial'; ctx.fillText('o mundo tivesse escolhido',width/2,height*.55); ctx.fillText('um caminho diferente?',width/2,height*.59); ctx.restore();",
"  ctx.fillStyle='rgba(255,255,255,.15)'; ctx.fillRect(width*.14,height*.88,width*.72,3); ctx.fillStyle='#79a5ff'; ctx.fillRect(width*.14,height*.88,width*.72*ease(t/duration),3);",
"  ctx.textAlign='center'; ctx.font='500 16px Arial'; ctx.fillStyle='rgba(210,223,255,.65)'; ctx.fillText('UMA ESCOLHA MUDA TUDO',width/2,height*.93);",
"}"
].join("\n");

const state = { page:"dashboard", projectId:null, projects:readProjects(), activeTab:"story", selectedScene:0, provider:"openai", providerKey:"", model:"", previewReady:false, frameWaiters:new Map(), exportCancel:false, liveAssets:[], db:null, playing:false };
function readProjects(){ try { const v=JSON.parse(localStorage.getItem(STORE_KEY)||"[]"); return Array.isArray(v)?v:[]; } catch(e){return [];} }
function persist(){localStorage.setItem(STORE_KEY,JSON.stringify(state.projects));}
function currentProject(){return state.projects.find(function(p){return p.id===state.projectId;})||null;}
function uid(){return crypto.randomUUID?crypto.randomUUID():"p"+Date.now()+Math.random().toString(16).slice(2);}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function dateLabel(v){try{return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short"}).format(new Date(v));}catch(e){return "agora";}}
function bytes(n){if(n<1024)return n+" B";if(n<1048576)return (n/1024).toFixed(0)+" KB";return (n/1048576).toFixed(1)+" MB";}
function timecode(v){const s=Math.max(0,Math.floor(Number(v)||0));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
function ic(n){
 const p={
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 clapper:'<path d="M4 7h16v13H4zM4 7l2-4h16l-2 4M8 3l3 4m3-4 3 4"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="m19 15 2 1-1 3-2-1-2 1-.5 2h-3l-.5-2-2-1-2 1-1-3 2-1v-2l-2-1 1-3 2 1 2-1 .5-2h3l.5 2 2 1 2-1 1 3-2 1z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>', play:'<path d="m8 5 11 7-11 7z"/>', pause:'<path d="M8 5h3v14H8zm6 0h3v14h-3z"/>',
 upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>', image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
 music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16m10-16v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
 type:'<path d="M4 7V4h16v3M12 4v16m-4 0h8"/>', wand:'<path d="m15 4 5 5M4 20 17 7m-4-3 1-2m5 13 2 1m-8 4 1-2"/>', branch:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4m0-12v4"/>',
 code:'<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', download:'<path d="M12 4v12m-5-5 5 5 5-5M4 20h16"/>',
 trash:'<path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/>', spark:'<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/>',
 file:'<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10zM13 3v7h7"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>'
 };
 return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(p[n]||p.spark)+"</svg>";
}
function navItem(page,ico,label){return '<button class="nav-item '+(state.page===page?"active":"")+'" data-act="navigate" data-page="'+page+'">'+ic(ico)+'<span>'+label+'</span></button>';}
function sidebar(){
 return '<aside class="sidebar"><div class="brand"><div class="brand-mark">W.</div><div><div class="brand-name">What If Studio</div><div class="brand-caption">FUZZY VIDEOMAKER</div></div></div><div class="nav-section">WORKSPACE</div><nav class="nav-list">'+navItem("dashboard","grid","Início")+navItem("studio","clapper","Editor de vídeo")+navItem("settings","settings","Configurações")+'</nav><div class="sidebar-spacer"></div><div class="sidebar-card"><div class="sidebar-card-label">LOCAL-FIRST STUDIO</div><p>Seus projetos ficam neste navegador. Chaves de IA não são salvas.</p><button class="btn btn-small btn-full" data-act="navigate" data-page="settings">Configurar IA '+ic("arrow")+'</button></div><div class="sidebar-foot"><div class="avatar">W</div><div class="foot-copy"><strong>Creator workspace</strong><span>Renderização local ativada</span></div></div></aside>';
}
function topbar(){
 const title=state.page==="studio"?"Editor":state.page==="settings"?"Configurações":"Workspace";
 return '<header class="topbar"><div class="topbar-left"><button class="mobile-menu" data-act="toggle-mobile-nav">'+ic("menu")+'</button><div class="breadcrumb"><span>What If Studio</span><span>/</span><strong>'+title+'</strong></div></div><div class="top-actions"><span class="status-pill"><i class="status-dot"></i> ARQUIVOS LOCAIS</span><button class="btn btn-small" data-act="navigate" data-page="settings">'+ic("settings")+' Preferências</button></div></header>';
}
function bottomNav(){
 return '<nav class="mobile-bottom"><button class="'+(state.page==="dashboard"?"active":"")+'" data-act="navigate" data-page="dashboard">'+ic("grid")+'<span>Início</span></button><button class="'+(state.page==="studio"?"active":"")+'" data-act="navigate" data-page="studio">'+ic("clapper")+'<span>Editor</span></button><button class="'+(state.page==="settings"?"active":"")+'" data-act="navigate" data-page="settings">'+ic("settings")+'<span>Ajustes</span></button></nav>';
}
function modal(){
 return '<div class="modal-backdrop" id="project-modal"><div class="modal"><div class="modal-head"><div><h2>Novo projeto</h2><p>Defina o ponto de partida. O restante pode mudar depois.</p></div><button class="modal-close" data-act="close-modal">×</button></div><form id="new-project-form"><div class="field"><label>Nome do projeto</label><input name="title" required maxlength="80" placeholder="Ex.: E se a Lua desaparecesse?"></div><div class="field"><label>Ideia / premissa</label><textarea name="prompt" required placeholder="Descreva o que acontece, o conflito e o que torna a ideia interessante."></textarea></div><div class="form-grid"><div class="field"><label>Formato</label><select name="format"><option>What if?</option><option>História ramificada</option><option>Comercial</option><option>Explicador</option><option>Storytelling</option></select></div><div class="field"><label>Plataforma</label><select name="platform"><option>Instagram Reels</option><option>TikTok</option><option>YouTube Shorts</option><option>Outro</option></select></div><div class="field"><label>Duração (segundos)</label><input name="duration" type="number" min="5" max="600" value="30"></div><div class="field"><label>Proporção</label><select name="ratio"><option value="9:16">9:16 vertical</option><option value="1:1">1:1 quadrado</option><option value="16:9">16:9 horizontal</option></select></div></div><div class="modal-footer"><button type="button" class="btn" data-act="close-modal">Cancelar</button><button type="submit" class="btn btn-primary">'+ic("plus")+' Criar projeto</button></div></form></div></div>';
}
function toast(msg,type){
 const stack=document.getElementById("toast-stack");if(!stack)return;
 const el=document.createElement("div");el.className="toast "+(type||"");el.textContent=msg;stack.appendChild(el);setTimeout(function(){el.remove();},4200);
}
function dashboardPage(){
 const count=state.projects.length;
 const recent=state.projects.slice().sort(function(a,b){return b.updatedAt-a.updatedAt;}).slice(0,3);
 const cards=recent.map(function(p){return '<button class="project-card" data-act="open-project" data-id="'+p.id+'"><div class="project-cover"></div><strong>'+esc(p.title)+'</strong><small>'+esc(p.format||"What if?")+' · '+dateLabel(p.updatedAt)+'</small></button>';}).join("");
 return '<main class="main"><div class="page"><section class="hero"><div class="hero-content"><div class="eyebrow">YOUR CREATOR WORKSPACE</div><h1>Transforme ideias em <span>mundos.</span></h1><p>Escreva histórias ramificadas, gere animações com código e transforme seus próprios arquivos em vídeos. A IA escreve o código. Seu navegador faz o render.</p><div class="hero-actions"><button class="btn btn-primary" data-act="new-project">'+ic("plus")+' Novo projeto</button><button class="btn" data-act="open-demo">'+ic("play")+' Ver projeto de demonstração</button></div></div></section>'+
 '<section class="grid-stats"><div class="stat"><div class="stat-icon">'+ic("clapper")+'</div><div><strong>'+count+'</strong><span>Projetos neste navegador</span></div></div><div class="stat"><div class="stat-icon">'+ic("film")+'</div><div><strong>9:16</strong><span>Formato vertical de referência</span></div></div><div class="stat"><div class="stat-icon">'+ic("code")+'</div><div><strong>JS / Canvas</strong><span>Renderização por código</span></div></div></section>'+
 '<div class="section-head"><div><h2>Comece por aqui</h2><p>Do primeiro gancho ao vídeo exportado.</p></div><span class="section-label">04 ETAPAS</span></div><div class="dashboard-grid"><section class="glass panel"><div class="panel-title"><h3>Fluxo de criação</h3><span>STUDIO PIPELINE</span></div><div class="workflow-list">'+
 '<div class="workflow"><div class="workflow-number">01</div><div><strong>Defina a ideia</strong><p>Premissa, formato, duração e gancho inicial.</p></div><span class="workflow-arrow">'+ic("arrow")+'</span></div>'+
 '<div class="workflow"><div class="workflow-number">02</div><div><strong>Construa a narrativa</strong><p>Cenas, cliffhangers, decisões e consequências.</p></div><span class="workflow-arrow">'+ic("arrow")+'</span></div>'+
 '<div class="workflow"><div class="workflow-number">03</div><div><strong>Gere o código visual</strong><p>O modelo escreve JavaScript para desenhar cada frame.</p></div><span class="workflow-arrow">'+ic("arrow")+'</span></div>'+
 '<div class="workflow"><div class="workflow-number">04</div><div><strong>Renderize e exporte</strong><p>A prévia e o arquivo final são processados no seu dispositivo.</p></div><span class="workflow-arrow">'+ic("play")+'</span></div></div></section>'+
 '<section class="glass panel"><div class="panel-title"><h3>Feito para criar</h3><span>CORE TOOLS</span></div><div class="feature-stack">'+
 '<div class="feature"><div class="feature-icon">'+ic("branch")+'</div><div><strong>Histórias ramificadas</strong><p>Opções de enquete com consequências para o próximo episódio.</p></div></div>'+
 '<div class="feature"><div class="feature-icon">'+ic("upload")+'</div><div><strong>Seus próprios assets</strong><p>Imagens, vídeos, trilhas e fontes importados por você.</p></div></div>'+
 '<div class="feature"><div class="feature-icon">'+ic("code")+'</div><div><strong>Código sob seu controle</strong><p>Edite o script, confira a prévia e exporte quando estiver pronto.</p></div></div></div></section></div>'+
 '<div class="section-head"><div><h2>Projetos recentes</h2><p>Salvos localmente no navegador atual.</p></div><button class="btn btn-small" data-act="new-project">'+ic("plus")+' Criar projeto</button></div>'+
 (cards?'<div class="project-grid">'+cards+'</div>':'<div class="empty-state"><div class="empty-state-icon">'+ic("clapper")+'</div><h3>Seu primeiro projeto começa aqui</h3><p>Crie uma ideia, transforme em roteiro e comece a montar a linguagem visual.</p><button class="btn btn-primary btn-small" data-act="new-project">'+ic("plus")+' Criar primeiro projeto</button></div>')+
 '</div></main>';
}
function settingsPage(){
 const placeholder=state.provider==="openai"?"gpt-6-mini":state.provider==="anthropic"?"claude-sonnet":"gemini-2.5-flash";
 return '<main class="main"><div class="page"><div class="workspace-head"><div class="workspace-title"><div class="eyebrow">PREFERÊNCIAS</div><h1>Configurações</h1><p>Conecte um modelo por chave própria. A chave fica somente na memória desta aba.</p></div></div><div class="dashboard-grid">'+
 '<section class="glass panel"><div class="panel-title"><h3>Provedor de IA</h3><span>BYO MODEL KEY</span></div><div class="field" style="margin-top:18px"><label>Provedor</label><select id="provider-select"><option value="openai" '+(state.provider==="openai"?"selected":"")+'>OpenAI</option><option value="anthropic" '+(state.provider==="anthropic"?"selected":"")+'>Anthropic / Claude</option><option value="gemini" '+(state.provider==="gemini"?"selected":"")+'>Google Gemini</option></select></div><div class="field"><label>Identificador do modelo</label><input id="model-input" placeholder="'+placeholder+'" value="'+esc(state.model)+'"></div><div class="field"><label>Chave de API</label><input id="key-input" type="password" autocomplete="off" placeholder="Cole sua chave aqui"></div><div class="notice"><strong>Privacidade:</strong> a chave não é gravada no localStorage, IndexedDB ou no projeto. Ela é mantida somente na memória desta aba e enviada para uma chamada. Fechar ou atualizar a página limpa a chave.</div><div style="display:flex;gap:8px;margin-top:15px;flex-wrap:wrap"><button class="btn btn-primary" data-act="save-provider">Aplicar nesta aba</button><button class="btn" data-act="clear-key">Limpar chave</button></div></section>'+
 '<section class="glass panel"><div class="panel-title"><h3>Como funciona</h3><span>ARQUITETURA</span></div><div class="feature-stack">'+
 '<div class="feature"><div class="feature-icon">'+ic("spark")+'</div><div><strong>IA de texto, não vídeo</strong><p>O modelo escreve roteiro e JavaScript. Não há geração de clipes por IA integrada ao fluxo.</p></div></div>'+
 '<div class="feature"><div class="feature-icon">'+ic("film")+'</div><div><strong>Renderização local</strong><p>Os frames são desenhados no navegador e codificados no dispositivo. Vídeos longos dependem da memória e potência do aparelho.</p></div></div>'+
 '<div class="feature"><div class="feature-icon">'+ic("file")+'</div><div><strong>Arquivos locais</strong><p>Projetos e mídia ficam neste navegador. Exporte backups para não perder seus trabalhos.</p></div></div>'+
 '<div class="feature"><div class="feature-icon">'+ic("check")+'</div><div><strong>Publicação manual</strong><p>O app prepara materiais; não publica, não lê enquetes e não raspa dados de redes sociais.</p></div></div></div></section></div>'+
 '<div class="section-head"><div><h2>Dados locais</h2><p>Você controla os projetos neste navegador.</p></div></div><section class="glass panel"><div class="panel-title"><h3>Backup do workspace</h3><span>'+state.projects.length+' PROJETOS</span></div><p style="font-size:11px;color:var(--muted);line-height:1.6;margin:12px 0 16px">Baixe os metadados e roteiros em JSON. Os arquivos de mídia não entram no backup nesta versão.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" data-act="export-backup">'+ic("download")+' Exportar backup JSON</button><button class="btn btn-danger" data-act="clear-projects">'+ic("trash")+' Apagar projetos locais</button></div></section></div></main>';
}
