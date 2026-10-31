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

function sceneList(p){
 const items=p.scenes.map(function(s,i){return '<button class="scene-item '+(i===state.selectedScene?"active":"")+'" data-act="select-scene" data-index="'+i+'"><span class="scene-index">'+String(i+1).padStart(2,"0")+'</span><span><span class="scene-name">'+esc(s.title)+'</span><span class="scene-time">'+Number(s.duration||0)+' SEC</span></span></button>';}).join("");
 return '<div class="glass editor-panel"><div class="editor-panel-head"><h3>Storyboard</h3><span>'+p.scenes.length+' CENAS</span></div><div class="scene-list">'+items+'</div><button class="scene-add" data-act="add-scene">+ Adicionar cena</button></div>';
}
function assetPanel(p){
 const items=state.liveAssets.map(function(a){
  const ico=a.kind==="image"?"image":a.kind==="audio"?"music":a.kind==="font"?"type":"film";
  return '<div class="asset-row"><div class="asset-type">'+ic(ico)+'</div><div class="asset-copy"><strong>'+esc(a.name)+'</strong><span>'+bytes(a.size||0)+'</span></div><button class="asset-remove" data-act="remove-asset" data-id="'+a.id+'" title="Remover">×</button></div>';
 }).join("");
 return '<div class="glass editor-panel"><div class="editor-panel-head"><h3>Biblioteca de mídia</h3><span>'+state.liveAssets.length+' ARQUIVOS</span></div><label class="asset-drop" id="asset-drop"><input id="asset-input" type="file" multiple accept="image/*,video/*,audio/*,.ttf,.otf,.woff,.woff2" hidden><span>'+ic("upload")+'</span><strong>Importar assets</strong><span>Imagens, vídeos, áudio e fontes<br>O conteúdo fica neste navegador</span></label><div class="asset-list">'+(items||'<div class="field-note">Nenhum asset importado.</div>')+'</div><div class="notice" style="margin-top:12px">Fontes importadas podem ser usadas no código de renderização. Evite arquivos enormes para manter a prévia fluida.</div></div>';
}
function storyTab(p){
 const s=p.scenes[state.selectedScene]||p.scenes[0];
 const branches=(p.branches||[]).map(function(b,i){
  return '<div class="branch-card"><strong><i class="branch-dot"></i> Opção '+(i+1)+'</strong><div class="field" style="margin:8px 0 0"><input data-branch="'+i+'" data-prop="label" value="'+esc(b.label)+'" placeholder="Texto da escolha"></div><div class="field" style="margin:7px 0 0"><textarea data-branch="'+i+'" data-prop="consequence" style="min-height:54px" placeholder="O que muda se esta opção vencer?">'+esc(b.consequence)+'</textarea></div></div>';
 }).join("");
 return '<div class="glass editor-panel"><div class="editor-panel-head"><h3>Narrativa</h3><span>STORY ENGINE</span></div><div class="field"><label>Premissa</label><textarea id="premise-input" style="min-height:100px">'+esc(p.prompt)+'</textarea></div><div class="field"><label>Roteiro / narração</label><textarea id="script-input" class="script-area" placeholder="Escreva ou gere o roteiro do vídeo...">'+esc(p.script||"")+'</textarea></div><div class="field"><label>Cena selecionada · '+esc(s?s.title:"")+'</label><textarea id="scene-description" style="min-height:74px" placeholder="O que acontece visualmente nesta cena?">'+esc(s?s.description:"")+'</textarea></div><div class="form-grid"><div class="field"><label>Segundos da cena</label><input id="scene-duration" type="number" min="1" max="180" value="'+Number(s?s.duration:5)+'"></div><div class="field"><label>Tom</label><select id="tone-input"><option '+(p.tone==="Cinematográfico"?"selected":"")+'>Cinematográfico</option><option '+(p.tone==="Urgente"?"selected":"")+'>Urgente</option><option '+(p.tone==="Misterioso"?"selected":"")+'>Misterioso</option><option '+(p.tone==="Documental"?"selected":"")+'>Documental</option></select></div></div><div class="editor-panel-head" style="margin-top:18px"><h3>Enquete / ramificações</h3><span>'+(p.branches||[]).length+' OPÇÕES</span></div><div class="field"><label>Pergunta para o público</label><input id="poll-input" value="'+esc(p.poll||"")+'" placeholder="Qual caminho deve acontecer?"></div>'+branches+'<button class="scene-add" data-act="add-branch">+ Adicionar opção</button><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:13px"><button class="btn btn-primary btn-small" data-act="generate-story">'+ic("spark")+' Gerar roteiro com IA</button><button class="btn btn-small" data-act="score-hook">Analisar gancho</button></div><div id="hook-score"></div></div>';
}
function codeTab(p){
 return '<div class="glass editor-panel"><div class="editor-panel-head"><h3>Código de animação</h3><span>JAVASCRIPT / CANVAS</span></div><div class="notice" style="margin-bottom:12px">O modelo deve retornar <strong>function renderFrame({ ctx, time, duration, width, height, assets })</strong>. O código roda em iframe sandbox sem acesso à rede.</div><textarea id="code-input" class="code-area" spellcheck="false">'+esc(p.code||DEMO_CODE)+'</textarea><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:11px"><button class="btn btn-primary btn-small" data-act="refresh-preview">'+ic("check")+' Aplicar no preview</button><button class="btn btn-small" data-act="generate-code">'+ic("wand")+' Gerar código com IA</button><button class="btn btn-small" data-act="demo-code">Carregar exemplo</button></div><p class="field-note" style="margin-top:10px">O sandbox limita o acesso do script à página, mas não impede consumo excessivo de CPU. Revise o código antes de exportar.</p></div>';
}
function aiTab(p){
 return '<div class="glass editor-panel"><div class="editor-panel-head"><h3>Modelos e geração</h3><span>TEXT-TO-CODE</span></div><div class="field"><label>Provedor</label><select id="studio-provider"><option value="openai" '+(state.provider==="openai"?"selected":"")+' >OpenAI</option><option value="anthropic" '+(state.provider==="anthropic"?"selected":"")+' >Claude / Anthropic</option><option value="gemini" '+(state.provider==="gemini"?"selected":"")+' >Gemini</option></select></div><div class="field"><label>Modelo</label><input id="studio-model" value="'+esc(state.model)+'" placeholder="ID de modelo da sua conta"></div><div class="field"><label>Chave de API desta aba</label><input id="studio-key" type="password" autocomplete="off" placeholder="'+(state.providerKey?"Chave carregada nesta aba":"Cole sua chave de API")+'"></div><div class="notice">A chave nunca é salva. Você precisa ter acesso à API e pode haver cobrança separada do plano de chat.</div><div style="display:flex;gap:7px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-primary btn-small" data-act="save-provider">Aplicar modelo</button><button class="btn btn-small" data-act="clear-key">Limpar chave</button></div><div class="editor-panel-head" style="margin-top:22px"><h3>Fluxo de geração</h3><span>2 PROMPTS</span></div><div class="feature-stack"><div class="feature"><div class="feature-icon">'+ic("spark")+'</div><div><strong>1 · Roteiro</strong><p>Gancho, progressão, narração, cliffhanger e alternativas.</p><button class="btn btn-small" data-act="generate-story" style="margin-top:8px">Gerar narrativa</button></div></div><div class="feature"><div class="feature-icon">'+ic("code")+'</div><div><strong>2 · Código de vídeo</strong><p>JavaScript para desenhar cada frame usando seus assets locais.</p><button class="btn btn-small" data-act="generate-code" style="margin-top:8px">Gerar código visual</button></div></div></div><div id="ai-status" class="field-note" style="margin-top:12px">A IA gera código; a codificação do vídeo acontece no seu dispositivo.</div></div>';
}
function rightEditor(p){
 const tabs=[["story","Narrativa"],["code","Código"],["ai","IA"]];
 return '<aside class="editor-right"><div class="glass editor-panel"><div class="editor-tabs">'+tabs.map(function(t){return '<button class="editor-tab '+(state.activeTab===t[0]?"active":"")+'" data-act="set-tab" data-tab="'+t[0]+'">'+t[1]+'</button>';}).join("")+'</div>'+(state.activeTab==="story"?storyTab(p):state.activeTab==="code"?codeTab(p):aiTab(p))+'</div>'+
 '<div class="glass editor-panel"><div class="editor-panel-head"><h3>Formato de saída</h3><span>EXPORT SETUP</span></div><div class="form-grid"><div class="field"><label>Duração · s</label><input id="duration-input" type="number" min="5" max="600" value="'+Number(p.duration||30)+'"></div><div class="field"><label>Proporção</label><select id="ratio-input"><option value="9:16" '+(p.ratio==="9:16"?"selected":"")+'>9:16</option><option value="1:1" '+(p.ratio==="1:1"?"selected":"")+'>1:1</option><option value="16:9" '+(p.ratio==="16:9"?"selected":"")+'>16:9</option></select></div></div><div class="field"><label>FPS</label><select id="fps-input"><option value="24">24 fps</option><option value="30" selected>30 fps</option><option value="60">60 fps</option></select></div><button class="btn btn-primary btn-full" data-act="export-video" id="export-btn">'+ic("download")+' Exportar vídeo</button><div id="export-progress" class="progress-wrap"><div class="progress-bar"><span id="export-progress-bar"></span></div><div id="export-progress-caption" class="progress-caption">Preparando renderização...</div><button class="btn btn-danger btn-small" data-act="cancel-export" style="margin-top:8px">Cancelar renderização</button></div><p class="field-note" style="margin-top:10px">A exportação é local. Arquivos longos exigem memória e bateria; escolha resolução e FPS adequados ao aparelho.</p></div></aside>';
}
function studioPage(){
 const p=currentProject();
 if(!p)return '<main class="main"><div class="page"><div class="empty-state"><h3>Nenhum projeto aberto</h3><p>Crie ou selecione um projeto para continuar.</p><button class="btn btn-primary" data-act="navigate" data-page="dashboard">Voltar ao início</button></div></div></main>';
 return '<main class="main"><div class="page"><div class="workspace-head"><div class="workspace-title"><div class="eyebrow">PROJECT WORKSPACE</div><h1>'+esc(p.title)+'</h1><p>'+esc(p.format)+' · '+esc(p.platform)+' · Atualizado '+dateLabel(p.updatedAt)+'</p></div><div class="top-actions"><button class="btn btn-small" data-act="export-project-json">'+ic("download")+' Exportar projeto</button><button class="btn btn-small" data-act="navigate" data-page="dashboard">Fechar editor</button></div></div><div class="editor-layout"><div class="editor-left">'+sceneList(p)+assetPanel(p)+'</div>'+
 '<section class="center-stage"><div class="glass preview-card"><div class="preview-head"><strong>Prévia vertical</strong><span id="preview-status">AGUARDANDO CÓDIGO</span></div><div class="preview-area"><div class="preview-frame"><iframe id="video-preview" sandbox="allow-scripts" title="Prévia do vídeo"></iframe></div></div><div class="preview-controls"><button class="control-play" data-act="toggle-preview" aria-label="Reproduzir">'+ic("play")+'</button><div class="range-wrap"><input type="range" id="seek-range" min="0" max="'+Number(p.duration||30)+'" step="0.1" value="0"></div><span class="time-readout" id="time-readout">00:00 / '+timecode(p.duration||30)+'</span></div><div class="stage-actions"><div class="stage-actions-left"><button class="btn btn-small" data-act="refresh-preview">'+ic("check")+' Atualizar prévia</button><button class="btn btn-small" data-act="demo-code">Exemplo visual</button></div><div class="stage-actions-right"><button class="btn btn-small" data-act="navigate" data-page="settings">Chave de IA</button></div></div></div><div class="glass timeline"><div class="timeline-head"><strong>Linha do tempo</strong><span class="section-label">'+p.scenes.length+' CLIPES</span></div><div class="timeline-track">'+p.scenes.map(function(){return '<div class="timeline-segment"></div>';}).join("")+'</div><div class="timeline-meta"><span>00:00</span><span>'+timecode(p.duration||30)+'</span></div></div></section>'+
 rightEditor(p)+'</div></div></main>';
}
function render(){
 root.innerHTML='<div class="shell">'+sidebar()+topbar()+(state.page==="studio"?studioPage():state.page==="settings"?settingsPage():dashboardPage())+bottomNav()+modal()+'<div class="toast-stack" id="toast-stack"></div></div>';
 if(state.page==="studio"&&currentProject())refreshPreview(true);
}
function openModal(){const m=document.getElementById("project-modal");if(m)m.classList.add("open");}
function closeModal(){const m=document.getElementById("project-modal");if(m)m.classList.remove("open");}
function createProject(data){
 const p={id:uid(),title:data.title,prompt:data.prompt,format:data.format,platform:data.platform,duration:Math.max(5,Math.min(600,Number(data.duration)||30)),ratio:data.ratio||"9:16",tone:"Cinematográfico",
 scenes:[{title:"Gancho",description:"Abra com a premissa visual mais forte.",duration:4},{title:"O que muda",description:"Mostre a primeira consequência concreta.",duration:8},{title:"Escalada",description:"Aumente as implicações e apresente um detalhe inesperado.",duration:10},{title:"Escolha",description:"Termine com uma decisão clara para a audiência.",duration:8}],
 branches:[{label:"Opção A",consequence:"A história segue pelo caminho A."},{label:"Opção B",consequence:"A história segue pelo caminho B."}],poll:"Qual caminho deve acontecer depois?",script:"",code:DEMO_CODE,assets:[],createdAt:Date.now(),updatedAt:Date.now()};
 state.projects.unshift(p);persist();state.projectId=p.id;state.page="studio";state.selectedScene=0;state.activeTab="story";render();toast("Projeto criado e salvo neste navegador.","success");
}
function openProject(id){
 const p=state.projects.find(function(x){return x.id===id;});if(!p)return;
 state.projectId=id;state.page="studio";state.selectedScene=0;state.activeTab="story";
 hydrateProjectAssets(p).then(function(){render();});
}
function updateProject(p){p.updatedAt=Date.now();persist();}
function openDb(){
 if(!("indexedDB" in window))return Promise.resolve(null);
 return new Promise(function(resolve,reject){
  const req=indexedDB.open("what-if-studio-media",1);
  req.onupgradeneeded=function(){const db=req.result;if(!db.objectStoreNames.contains("assets"))db.createObjectStore("assets",{keyPath:"id"});};
  req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error);};
 });
}
function dbRequest(mode,action){
 return new Promise(function(resolve,reject){
  if(!state.db){reject(new Error("IndexedDB indisponível."));return;}
  const tx=state.db.transaction("assets",mode);const req=action(tx.objectStore("assets"));
  req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error);};
 });
}
function saveAssetFile(id,file){return dbRequest("readwrite",function(store){return store.put({id:id,file:file});});}
function getAssetFile(id){return dbRequest("readonly",function(store){return store.get(id);}).then(function(row){return row?row.file:null;});}
function deleteAssetFile(id){return dbRequest("readwrite",function(store){return store.delete(id);});}
async function hydrateProjectAssets(p){
 state.liveAssets=[];
 for(const asset of p.assets||[]){try{const file=await getAssetFile(asset.id);if(file)state.liveAssets.push(Object.assign({},asset,{file:file}));}catch(e){}}
}
function kindFor(file){
 if(file.type.startsWith("image/"))return "image";
 if(file.type.startsWith("video/"))return "video";
 if(file.type.startsWith("audio/"))return "audio";
 if(/\.(ttf|otf|woff|woff2)$/i.test(file.name))return "font";
 return "other";
}
async function importFiles(files){
 const p=currentProject();if(!p)return;
 const list=Array.from(files||[]);if(!list.length)return;let added=0;
 for(const file of list){
  if(file.size>300*1024*1024){toast("Arquivo muito grande (limite local de 300 MB): "+file.name,"error");continue;}
  const id=uid();const meta={id:id,name:file.name,size:file.size,type:file.type,kind:kindFor(file),lastModified:file.lastModified};
  try{await saveAssetFile(id,file);p.assets.push(meta);state.liveAssets.push(Object.assign({},meta,{file:file}));added++;}
  catch(e){toast("Não foi possível salvar "+file.name+" no navegador.","error");}
 }
 updateProject(p);render();toast(added+" arquivo(s) importado(s).","success");
}
async function removeAsset(id){
 const p=currentProject();if(!p)return;
 p.assets=p.assets.filter(function(a){return a.id!==id;});state.liveAssets=state.liveAssets.filter(function(a){return a.id!==id;});
 try{await deleteAssetFile(id);}catch(e){}updateProject(p);render();
}

function frameDocument(){
 const script=[
 "(function(){",
 "const canvas=document.getElementById('c'),ctx=canvas.getContext('2d',{alpha:false});let W=720,H=1280,D=30,renderFn=null,assets={},playing=false,start=0,current=0,raf=0,nonce='';",
 "function send(type,extra){parent.postMessage(Object.assign({source:'whatif-frame',type:type,nonce:nonce},extra||{}),'*');}",
 "function fail(err){send('error',{message:String(err&&err.message||err).slice(0,700)});}",
 "async function loadAsset(a){const file=a.file,url=URL.createObjectURL(file),item={id:a.id,name:a.name,kind:a.kind,url:url,file:file,element:null,family:null};",
 "if(a.kind==='image'){const el=new Image();el.src=url;await el.decode();item.element=el;}",
 "else if(a.kind==='video'||a.kind==='audio'){const el=document.createElement(a.kind);el.src=url;el.preload='auto';el.muted=true;el.playsInline=true;await new Promise(ok=>{if(el.readyState>=1)ok();else{el.onloadedmetadata=ok;el.onerror=ok;setTimeout(ok,4000);}});item.element=el;}",
 "else if(a.kind==='font'){const family='UserFont_'+a.id.replace(/[^a-z0-9]/gi,'');const face=new FontFace(family,'url('+url+')');await face.load();document.fonts.add(face);item.family=family;item.element=face;}",
 "assets[a.id]=item;}",
 "function draw(t){current=Math.max(0,Math.min(D,Number(t)||0));for(const id in assets){const a=assets[id];if(a.kind==='video'&&a.element&&Number.isFinite(a.element.duration)){const target=Math.min(current,Math.max(0,a.element.duration-.05));if(Math.abs(a.element.currentTime-target)>.15){try{a.element.currentTime=target;}catch(e){}}}}",
 "if(!renderFn)throw new Error('Código ainda não carregado.');ctx.clearRect(0,0,W,H);renderFn({ctx:ctx,time:current,duration:D,width:W,height:H,assets:assets,canvas:canvas});}",
 "function loop(now){if(!playing)return;current=(now-start)/1000;if(current>=D){current=D;playing=false;}try{draw(current);send('tick',{time:current,duration:D});}catch(e){playing=false;fail(e);}if(playing)raf=requestAnimationFrame(loop);else send('paused',{time:current});}",
 "async function init(m){nonce=m.nonce;W=m.width||720;H=m.height||1280;D=m.duration||30;canvas.width=W;canvas.height=H;assets={};",
 "for(const a of (m.assets||[])){try{await loadAsset(a);}catch(e){send('asset-error',{name:a.name,message:String(e.message||e)});}}",
 "try{renderFn=new Function(m.code+'; return (typeof renderFrame === \"function\") ? renderFrame : null;')();if(!renderFn)throw new Error('Defina function renderFrame({ctx,time,duration,width,height,assets}).');draw(0);send('ready',{width:W,height:H});}catch(e){fail(e);}}",
 "window.addEventListener('message',async ev=>{const m=ev.data||{};if(m.source!=='whatif-parent')return;if(m.type==='init'){init(m);return;}if(m.nonce!==nonce)return;",
 "if(m.type==='play'&&!playing){playing=true;start=performance.now()-current*1000;raf=requestAnimationFrame(loop);}",
 "if(m.type==='pause'){playing=false;cancelAnimationFrame(raf);send('paused',{time:current});}",
 "if(m.type==='seek'){playing=false;cancelAnimationFrame(raf);try{draw(m.time);send('tick',{time:current,duration:D});}catch(e){fail(e);}}",
 "if(m.type==='frame'){playing=false;cancelAnimationFrame(raf);try{draw(m.time);const bmp=await createImageBitmap(canvas);parent.postMessage({source:'whatif-frame',type:'frame',nonce:nonce,requestId:m.requestId,bitmap:bmp},'*',[bmp]);}catch(e){fail(e);}}",
 "});send('boot');})();"
 ].join("\n");
 return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; style-src \'unsafe-inline\'; img-src blob: data:; media-src blob: data:; font-src blob: data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#080a10}canvas{width:100%;height:100%;display:block;object-fit:contain}</style></head><body><canvas id="c"></canvas><script>'+script+'<\/script></body></html>';
}
function ratioSize(ratio){
 if(ratio==="1:1")return {width:1080,height:1080};
 if(ratio==="16:9")return {width:1280,height:720};
 return {width:720,height:1280};
}
function postToFrame(message){
 const frame=document.getElementById("video-preview");
 if(frame&&frame.contentWindow)frame.contentWindow.postMessage(Object.assign({source:"whatif-parent"},message),"*");
}
async function refreshPreview(quiet){
 const p=currentProject(),frame=document.getElementById("video-preview");
 if(!p||!frame)return;
 state.previewReady=false;
 const status=document.getElementById("preview-status");if(status)status.textContent="CARREGANDO...";
 try{
  if(!state.liveAssets.length&&(p.assets||[]).length)await hydrateProjectAssets(p);
  const assets=state.liveAssets.map(function(a){return {id:a.id,name:a.name,kind:a.kind,file:a.file};});
  const dim=ratioSize(p.ratio),nonce=uid();state.frameNonce=nonce;
  frame.onload=function(){
   frame.contentWindow.postMessage({source:"whatif-parent",type:"init",nonce:nonce,code:p.code||DEMO_CODE,assets:assets,width:dim.width,height:dim.height,duration:Number(p.duration||30)},"*");
  };
  frame.srcdoc=frameDocument();
 }catch(err){if(!quiet)toast("Não foi possível preparar a prévia: "+err.message,"error");}
}
function requestFrame(time){
 return new Promise(function(resolve,reject){
  const requestId=uid(),timer=setTimeout(function(){state.frameWaiters.delete(requestId);reject(new Error("A prévia demorou demais para desenhar um frame."));},8000);
  state.frameWaiters.set(requestId,function(data){clearTimeout(timer);if(data.error)reject(new Error(data.error));else resolve(data.bitmap);});
  postToFrame({type:"frame",nonce:state.frameNonce,time:time,requestId:requestId});
 });
}
function readEditorIntoProject(){
 const p=currentProject();if(!p)return;
 const premise=document.getElementById("premise-input"),script=document.getElementById("script-input"),code=document.getElementById("code-input"),desc=document.getElementById("scene-description"),sceneDuration=document.getElementById("scene-duration"),poll=document.getElementById("poll-input"),tone=document.getElementById("tone-input"),duration=document.getElementById("duration-input"),ratio=document.getElementById("ratio-input");
 if(premise)p.prompt=premise.value;if(script)p.script=script.value;if(code)p.code=code.value;if(poll)p.poll=poll.value;if(tone)p.tone=tone.value;
 if(duration)p.duration=Math.max(5,Math.min(600,Number(duration.value)||30));if(ratio)p.ratio=ratio.value;
 const scene=p.scenes[state.selectedScene];if(scene){if(desc)scene.description=desc.value;if(sceneDuration)scene.duration=Math.max(1,Math.min(180,Number(sceneDuration.value)||5));}
 document.querySelectorAll("[data-branch]").forEach(function(el){const i=Number(el.dataset.branch);if(p.branches[i])p.branches[i][el.dataset.prop]=el.value;});
 updateProject(p);
}
function syncProjectInputs(){
 const p=currentProject();if(!p)return;
 const duration=document.getElementById("duration-input"),ratio=document.getElementById("ratio-input");
 if(duration)p.duration=Math.max(5,Math.min(600,Number(duration.value)||30));if(ratio)p.ratio=ratio.value;updateProject(p);
}
function showHookScore(){
 const p=currentProject();if(!p)return;
 const textValue=(p.script||"").trim(),first=(textValue.split(/[.!?\n]/)[0]||"").trim(),words=first.split(/\s+/).filter(Boolean);
 let score=45;const lower=first.toLowerCase();
 if(/^(e se|imagine|ningu[eé]m|o que aconteceria|por que|como seria)/i.test(lower))score+=16;
 if(/\d/.test(first))score+=10;if(words.length>=5&&words.length<=14)score+=12;if(/[!?]/.test(first))score+=7;
 if(/hoje|neste vídeo|olá|oi pessoal|bem-vindos/i.test(lower))score-=18;if(first.length>115)score-=15;
 score=Math.max(0,Math.min(100,score));
 const box=document.getElementById("hook-score");
 if(box)box.innerHTML='<div class="score-row"><div class="score-number">'+score+'</div><div class="score-copy"><strong>Heurística de gancho · '+(score>=75?"Forte":score>=55?"Razoável":"Precisa de trabalho")+'</strong><span>“'+esc(first||"Adicione um roteiro para analisar o gancho.")+'”<br>Regra local simples; não prevê viralização nem substitui dados reais de retenção.</span></div></div>';
}

function saveProvider(){
 const provider=document.getElementById("studio-provider")||document.getElementById("provider-select");
 const model=document.getElementById("studio-model")||document.getElementById("model-input");
 const key=document.getElementById("studio-key")||document.getElementById("key-input");
 if(provider)state.provider=provider.value;if(model)state.model=model.value.trim();if(key&&key.value.trim())state.providerKey=key.value.trim();
 toast(state.providerKey?"Modelo aplicado nesta aba.":"Modelo selecionado. Adicione uma chave para gerar.","success");
}
function clearKey(){
 state.providerKey="";
 const el=document.getElementById("studio-key")||document.getElementById("key-input");if(el)el.value="";
 toast("Chave removida da memória desta aba.","success");
}
async function callAI(mode){
 const p=currentProject();if(!p)return;readEditorIntoProject();
 if(!state.providerKey){state.page="settings";render();toast("Configure uma chave de API para gerar conteúdo.","error");return;}
 if(!state.model.trim()){toast("Informe o identificador de modelo do provedor.","error");return;}
 const status=document.getElementById("ai-status");if(status)status.textContent="Enviando solicitação ao modelo...";
 const assets=(p.assets||[]).map(function(a){return a.name+" ("+a.kind+")";}).join(", ");
 const scenes=p.scenes.map(function(s,i){return (i+1)+". "+s.title+" — "+s.description+" ("+s.duration+"s)";}).join("\n");
 let instructions="",prompt="";
 if(mode==="story"){
  instructions="Você é roteirista e diretor criativo de vídeos curtos verticais. Escreva em português brasileiro natural, com ritmo oral, imagens concretas, cortes frequentes e causalidade clara. Não prometa viralização. Sem conteúdo sexual explícito, violência gráfica ou autolesão. Retorne somente roteiro organizado por timecodes, narração, visual e som. Termine com pergunta clara e opções de enquete com consequências narrativas distintas.";
  prompt="PROJETO: "+p.title+"\nFORMATO: "+p.format+"\nPLATAFORMA: "+p.platform+"\nDURAÇÃO: "+p.duration+" segundos\nTOM: "+p.tone+"\nIDEIA: "+p.prompt+"\nCENAS PLANEJADAS:\n"+scenes+"\nRAMIFICAÇÕES:\n"+p.branches.map(function(b){return b.label+": "+b.consequence;}).join("\n")+"\nASSETS DISPONÍVEIS: "+assets+"\n\nCrie um roteiro completo para a duração indicada, com gancho imediato, batidas cronometradas e cliffhanger.";
 }else{
  instructions="Você é um engenheiro criativo de motion design. Gere JavaScript puro executável no Canvas 2D. Retorne APENAS código JavaScript, sem Markdown. Defina exatamente function renderFrame({ ctx, time, duration, width, height, assets }). A função desenha o frame inteiro com determinismo temporal. Use ctx, gradients, formas, tipografia e transições suaves. Não use fetch, rede, imports, DOM, módulos, timers, APIs de sistema ou dependências externas. Não acesse assets por caminho arbitrário: use o mapa assets recebido; cada item tem kind, element, name e, para fontes, family. Desenhe com fallback se assets estiver vazio. Evite loops infinitos e operações caras. Faça layout legível em 9:16 e mantenha textos dentro da área segura. Não gere vídeo por IA.";
  prompt="Crie código de animação para o projeto "+p.title+".\nIdeia: "+p.prompt+"\nRoteiro: "+p.script+"\nCenas:\n"+scenes+"\nDuração: "+p.duration+"s\nProporção: "+p.ratio+"\nAssets: "+assets+"\n\nQuero motion graphics original, composição pensada, ritmo visual e gancho forte. Canvas width e height são dinâmicos. Desenhe tudo a partir de time.";
 }
 try{
  const response=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({provider:state.provider,model:state.model.trim(),apiKey:state.providerKey,prompt:prompt,instructions:instructions})});
  const data=await response.json().catch(function(){return {};});
  if(!response.ok)throw new Error(data.error||"O provedor recusou a solicitação.");
  if(!data.text)throw new Error("O modelo retornou uma resposta vazia.");
  if(mode==="story"){p.script=data.text;state.activeTab="story";}
  else{let code=data.text.trim();if(code.charCodeAt(0)===96){code=code.split("\n").slice(1,-1).join("\n");}p.code=code;state.activeTab="code";}
  updateProject(p);render();if(mode==="code")refreshPreview(false);
  toast(mode==="story"?"Roteiro gerado.":"Código visual gerado. Confira a prévia.","success");
 }catch(err){
  toast(err.message||"Falha ao gerar conteúdo.","error");
  const s=document.getElementById("ai-status");if(s)s.textContent="Falha: "+err.message;
 }
}
