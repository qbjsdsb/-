
const DATASET_META={
  heroes:{label:"英雄",subtitle:"技能、定位、阵营与构筑关系",filters:[["camp","阵营"],["quality","品阶"],["role","定位"]]},
  players:{label:"棋手",subtitle:"技能、秘技与专属牌",filters:[]},
  equips:{label:"装备",subtitle:"铸造、类别、方向与阵营装备",filters:[["quality","品阶"],["cls","类别"],["kind","方向"],["cat","阵营"]]},
  talents:{label:"天赋",subtitle:"品阶、天赋包与拍卖轮次",filters:[["quality","品阶"],["grp","来源"],["stage","轮次"]]},
  effects:{label:"效果牌",subtitle:"通用与阵营专属节奏牌",filters:[["quality","品阶"],["cat","类型"]]},
  buffs:{label:"机制",subtitle:"关键词、体系与规则联动",filters:[["kind","类型"],["camp","阵营"]]},
  tips:{label:"冷知识",subtitle:"容易忽略但会影响决策的规则",filters:[["cat","类型"]]},
  news:{label:"资讯",subtitle:"官方与版本信息索引",filters:[["cat","类型"]]}
};
const LIBRARY_TYPES=["heroes","players","equips","talents","effects","buffs","tips"];
const KEYWORDS=["登场","整备","开团","牺牲","退场","凯旋","败阵","夺取","闪现","复生","图腾","临时等级","永久等级","觉醒","召唤","古币","合成","装备"];
const CAMP_PROFILE={
  "河洛":"古币、牺牲与复生滚动成长",
  "逐鹿":"战术牌、护盾与合成成长",
  "无阵营":"独立机制完整，灵活补位",
  "日落海":"整备、装备与核心等级联动",
  "三分之地":"登场、刷新与控制联动",
  "大河流域":"图腾、开团与召唤体系"
};
const CAMP_COLOR={
  "河洛":"#B99652","逐鹿":"#A85F5A","无阵营":"#7D838C","日落海":"#5D7FA9","三分之地":"#4F8A75","大河流域":"#4D91A0"
};
const state={
  manifest:null,patches:null,data:{},layout:localStorage.getItem("wxq-layout")||"list",
  theme:localStorage.getItem("wxq-theme")||"dark",
  libraryQuery:"",filters:{},libraryType:null,compCamp:"全部"
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const text=v=>{
  if(v==null)return"";
  if(["string","number","boolean"].includes(typeof v))return String(v);
  if(Array.isArray(v))return v.map(text).join(" ");
  if(typeof v==="object")return Object.values(v).map(text).join(" ");
  return""
};
const nameOf=x=>x?.name||x?.title||x?.id||"未命名";
const descOf=x=>x?.desc||x?.description||x?.summary||x?.text||x?.skill?.d||x?.note||"";
const qLabel=q=>q==null||q===""?"":(/阶|T\d/i.test(String(q))?String(q):String(q)+"阶");
const toId=v=>String(v??"");
const enc=v=>encodeURIComponent(String(v??""));
const assetUrl=p=>!p?"":(/^https?:/i.test(p)?p:(state.manifest?.assetBase||"")+p);

function normalise(raw,key){
  if(Array.isArray(raw))return raw;
  if(!raw||typeof raw!=="object")return[];
  if(Array.isArray(raw[key]))return raw[key];
  if(key==="buffs"&&Array.isArray(raw.groups)){
    return raw.groups.flatMap(g=>Array.isArray(g.items)?g.items.map(x=>({...x,kind:x.kind||g.kind||g.name})): [g])
  }
  const arrays=Object.values(raw).filter(Array.isArray);
  if(arrays.length===1)return arrays[0];
  return Object.entries(raw).filter(([,v])=>v&&typeof v==="object"&&!Array.isArray(v)).map(([id,v])=>({id,...v}))
}
function mergeOverrides(base,overrides){
  const rows=[...base];
  for(const patch of overrides||[]){
    const key=patch.id??patch.name;
    const i=rows.findIndex(x=>(x.id??x.name)===key);
    if(i>=0)rows[i]={...rows[i],...patch}; else rows.push(patch)
  }
  return rows
}
async function getJson(url){
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok)throw new Error(r.status+" "+r.statusText);
  return r.json()
}
function highlighted(v){
  let s=esc(text(v));
  for(const k of KEYWORDS)s=s.replaceAll(k,`<span class="keyword">${k}</span>`);
  return s
}
function firstGlyph(v){return esc([...nameOf(v)][0]||"·")}
function thumb(x,sizeClass=""){
  const src=assetUrl(x?.img||x?.avatar);
  return `<span class="thumb ${sizeClass}" data-camp="${esc(x?.camp||x?.cat||"")}"><span>${firstGlyph(x)}</span>${src?`<img src="${esc(src)}" alt="" loading="lazy" data-fallback>`:""}</span>`
}
function tagsFor(x){
  return [qLabel(x?.quality||x?.tier),x?.camp,x?.role,x?.cat,x?.kind,x?.cls,x?.grp,x?.timing,x?.classificationLabel]
    .flatMap(v=>Array.isArray(v)?v:[v]).filter(Boolean).slice(0,5)
}
function routeParts(){
  const raw=(location.hash||"#/home").replace(/^#\/?/,"");
  return raw.split("/").filter(Boolean).map(decodeURIComponent)
}
function setRoute(path){location.hash=path.startsWith("#")?path:"#/"+path.replace(/^\//,"")}
function entityRoute(type,item){return `#/entity/${type}/${enc(item.id??item.name)}`}
function compRoute(comp){return `#/comp/${enc(comp.id)}`}
function findById(type,id){
  return (state.data[type]||[]).find(x=>toId(x.id??x.name)===toId(id))
}
function typeLabel(t){return DATASET_META[t]?.label||({comps:"阵容",news:"资讯"}[t]||t)}
function applyTheme(){document.documentElement.dataset.theme=state.theme==="light"?"light":"dark"}
function topRoute(parts){
  if(parts[0]==="library"||parts[0]==="entity")return"library";
  if(parts[0]==="comp")return"comps";
  if(parts[0]==="more")return"more";
  return parts[0]||"home"
}
function updateChrome(parts){
  const top=topRoute(parts);
  $$(".primary-nav a").forEach(a=>a.classList.toggle("active",a.dataset.nav===top));
  $$(".mobile-nav a").forEach(a=>{
    const key=a.dataset.mobileNav;
    a.classList.toggle("active",key===top||(key==="more"&&(top==="version"||top==="tools")))
  });
  const isLib=parts[0]==="library"||parts[0]==="entity";
  $("#libraryContext").classList.toggle("hidden",!isLib);
  renderLibrarySide(parts[0]==="library"?parts[1]:(parts[0]==="entity"?parts[1]:null));
}
function renderLibrarySide(active){
  $("#librarySideNav").innerHTML=LIBRARY_TYPES.map(k=>`<a href="#/library/${k}" class="${active===k?"active":""}"><span>${DATASET_META[k].label}</span><span class="secondary-count">${state.data[k]?.length||0}</span></a>`).join("")
}
function openSearch(prefill=""){
  const d=$("#searchDialog");
  if(!d.open)d.showModal();
  const input=$("#globalSearchInput");
  input.value=prefill;
  renderGlobalSearch(prefill);
  requestAnimationFrame(()=>input.focus())
}
function closeSearch(){if($("#searchDialog").open)$("#searchDialog").close()}
function globalMatches(q){
  if(!q.trim())return[];
  const needle=q.trim().toLowerCase();
  const groups=[];
  for(const [type,rows] of Object.entries(state.data)){
    if(type==="camps")continue;
    const hits=(rows||[]).filter(x=>text(x).toLowerCase().includes(needle)).slice(0,8);
    if(hits.length)groups.push([type,hits])
  }
  const comps=(state.data.comps||[]).filter(x=>text(x).toLowerCase().includes(needle)).slice(0,8);
  if(comps.length&&!groups.some(([t])=>t==="comps"))groups.push(["comps",comps]);
  return groups
}
function renderGlobalSearch(q){
  const box=$("#globalSearchResults");
  if(!q.trim()){
    box.innerHTML=`<div class="search-group"><div class="search-group-title">常用机制</div><div class="keyword-cloud" style="padding:0 14px 10px">${KEYWORDS.slice(0,12).map(k=>`<button class="keyword-button" data-search="${esc(k)}">${esc(k)}</button>`).join("")}</div></div>`;
    bindSearchShortcuts();
    return
  }
  const groups=globalMatches(q);
  if(!groups.length){
    box.innerHTML=`<div class="empty-state"><strong>没有找到“${esc(q)}”</strong><p>试试机制名称、英雄名、装备名或阵容核心。</p></div>`;
    return
  }
  box.innerHTML=groups.map(([type,rows])=>`
    <section class="search-group">
      <div class="search-group-title">${esc(typeLabel(type))}</div>
      ${rows.map(x=>{
        const href=type==="comps"?compRoute(x):entityRoute(type,x);
        return `<div class="search-result" data-href="${href}">${thumb(x)}<div><strong>${esc(nameOf(x))}</strong><small>${esc(descOf(x)||tagsFor(x).join(" · "))}</small></div><span>↗</span></div>`
      }).join("")}
    </section>`
  ).join("");
  $$(".search-result[data-href]").forEach(el=>el.addEventListener("click",()=>{closeSearch();location.hash=el.dataset.href}))
}
function bindSearchShortcuts(){
  $$("[data-search]").forEach(b=>b.addEventListener("click",()=>{const q=b.dataset.search;$("#globalSearchInput").value=q;renderGlobalSearch(q)}))
}
function bindStatic(){
  $("#searchTrigger").addEventListener("click",()=>openSearch());
  $("#searchClose").addEventListener("click",closeSearch);
  $("#globalSearchInput").addEventListener("input",e=>renderGlobalSearch(e.target.value));
  $("#themeButton").addEventListener("click",()=>{
    state.theme=state.theme==="dark"?"light":"dark";
    localStorage.setItem("wxq-theme",state.theme);applyTheme()
  });
  $("#versionPill").addEventListener("click",()=>setRoute("version"));
  $("#searchDialog").addEventListener("click",e=>{if(e.target===$("#searchDialog"))closeSearch()});
  document.addEventListener("keydown",e=>{
    if((e.key==="/"||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"))&&!$("#searchDialog").open){
      if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName))return;
      e.preventDefault();openSearch()
    }
    if(e.key==="Escape")closeSearch()
  });
  document.addEventListener("error",e=>{
    if(e.target instanceof HTMLImageElement&&e.target.hasAttribute("data-fallback"))e.target.classList.add("failed")
  },true);
  window.addEventListener("hashchange",renderRoute)
}
async function boot(){
  applyTheme();bindStatic();
  try{
    state.manifest=await getJson("./data/manifest.json");
    state.patches=await getJson(state.manifest.patches);
    const overrides=await getJson(state.manifest.overrides);
    await Promise.all(Object.entries(state.manifest.datasets).map(async([key,url])=>{
      state.data[key]=mergeOverrides(normalise(await getJson(url),key),overrides[key])
    }));
    $("#versionPill").textContent=`v${state.manifest.gameVersion}`;
    $("#sidebarVersion").textContent=`v${state.manifest.gameVersion} · ${state.manifest.gameVersionDate}`;
    if(!location.hash)location.hash="#/home"; else renderRoute()
  }catch(e){
    $("#view").innerHTML=`<div class="empty-state"><strong>资料加载失败</strong><p>${esc(e.message)}。请刷新页面重试。</p></div>`
  }
}
function renderRoute(){
  const parts=routeParts();
  updateChrome(parts);
  const view=$("#view");
  if(parts[0]==="home")renderHome(view);
  else if(parts[0]==="library")renderLibrary(view,LIBRARY_TYPES.includes(parts[1])?parts[1]:"heroes");
  else if(parts[0]==="comps")renderComps(view);
  else if(parts[0]==="comp")renderCompDetail(view,parts[1]);
  else if(parts[0]==="entity")renderEntityDetail(view,parts[1],parts[2]);
  else if(parts[0]==="version")renderVersion(view);
  else if(parts[0]==="tools")renderTools(view);
  else if(parts[0]==="more")renderMore(view);
  else renderHome(view);
  view.focus({preventScroll:true});window.scrollTo({top:0,behavior:"instant"})
}
function renderHome(view){
  const p=state.patches.current;
  const camps=state.data.camps||[];
  const changes=(p.changes||[]).slice(0,5);
  view.innerHTML=`
    <section class="home-hero">
      <div class="eyebrow">WANGZHE WANXIANGQI · v${esc(state.manifest.gameVersion)}</div>
      <h1>万象图鉴</h1>
      <p>查英雄、看阵容、理解机制，也追踪每一次版本变化。复杂信息应该能被快速找到，而不是被迫记住。</p>
      <button class="home-search" id="homeSearch" type="button">
        <span class="search-icon">⌕</span>
        <span><strong>搜索英雄、装备、天赋、阵容或机制</strong><br><span>跨全部资料一次查找</span></span>
        <kbd>/</kbd>
      </button>
      <div class="suggest-row"><span class="suggest-label">试试</span>${["云中君","牺牲","图腾","古币","复生"].map(q=>`<button class="suggest" data-home-search="${q}">${q}</button>`).join("")}</div>
    </section>

    <div class="patch-strip" id="homePatch">
      <div class="patch-version"><strong>v${esc(p.version)}</strong><small>${esc(p.date)}</small></div>
      <div class="patch-summary"><strong>当前版本${liveDrifts().length?` · <span class="data-drift">${liveDrifts().length} 项资料待同步</span>`:""}</strong><p>${esc(changes.map(c=>c.name).slice(0,4).join(" · "))}</p></div>
      <span class="patch-link">查看完整更新 →</span>
    </div>

    <section class="section">
      <div class="section-title-row"><div><h2>快速进入</h2><p>按你现在要解决的问题进入，而不是浏览数据库目录。</p></div></div>
      <div class="quick-grid">
        ${quickLink("#/library/heroes","英雄","技能 · 关键词 · 搭配",state.data.heroes?.length||0)}
        ${quickLink("#/comps","阵容","核心 · 站位 · 装备",state.data.comps?.length||0)}
        ${quickLink("#/library/equips","装备","铸造 · 类型 · 适配",state.data.equips?.length||0)}
        ${quickLink("#/library/buffs","机制","登场 · 整备 · 牺牲",state.data.buffs?.length||0)}
      </div>
    </section>

    <section class="section">
      <div class="section-title-row"><div><h2>六大阵营</h2><p>先理解体系主轴，再理解单卡。</p></div><a class="section-link" href="#/library/heroes">查看全部英雄 →</a></div>
      <div class="camp-list">
        ${camps.map(c=>`<div class="camp-row" data-camp-route="${esc(c.name)}"><div class="camp-name"><span class="camp-dot" style="--camp-color:${CAMP_COLOR[c.name]||"#7D838C"}"></span>${esc(c.name)}</div><div class="camp-desc">${esc(CAMP_PROFILE[c.name]||"")}</div><div class="camp-meta">${c.count} 英雄 · ${c.five} 名 5阶</div><div class="arrow">→</div></div>`).join("")}
      </div>
    </section>

    <section class="section two-column">
      <div>
        <div class="section-title-row"><div><h2>最近变化</h2><p>先看到会影响决策的内容。</p></div><a class="section-link" href="#/version">版本记录 →</a></div>
        <div class="change-list">${changes.map(c=>`<div class="change-row"><div class="change-kind">${esc(c.kind)}</div><div class="change-main"><strong>${esc(c.name)}</strong><p>${esc(c.summary)}</p></div></div>`).join("")}</div>
      </div>
      <div>
        <div class="section-title-row"><div><h2>常用机制</h2><p>从关键词反查英雄、天赋与效果。</p></div></div>
        <div class="keyword-cloud">${KEYWORDS.map(k=>`<button class="keyword-button" data-keyword="${esc(k)}">${esc(k)} <span>${keywordCount(k)}</span></button>`).join("")}</div>
      </div>
    </section>
  `;
  $("#homeSearch").addEventListener("click",()=>openSearch());
  $$("[data-home-search]").forEach(b=>b.addEventListener("click",()=>openSearch(b.dataset.homeSearch)));
  $("#homePatch").addEventListener("click",()=>setRoute("version"));
  $$("[data-keyword]").forEach(b=>b.addEventListener("click",()=>openSearch(b.dataset.keyword)));
  $$("[data-camp-route]").forEach(r=>r.addEventListener("click",()=>{
    state.filters={camp:r.dataset.campRoute};setRoute("library/heroes")
  }))
}
function quickLink(href,title,sub,count){
  return `<a class="quick-link" href="${href}"><small>${count} 条资料</small><strong>${title}</strong><p>${sub}</p><span>进入 →</span></a>`
}
function keywordCount(k){
  return ["heroes","talents","effects","buffs"].reduce((n,type)=>n+(state.data[type]||[]).filter(x=>text(x).includes(k)).length,0)
}
function liveDrifts(){
  return Object.entries(state.manifest?.expectedLiveCounts||{}).filter(([key,live])=>(state.data[key]?.length||0)!==live)
}
function libraryFiltered(type){
  const rows=state.data[type]||[];
  const q=state.libraryQuery.trim().toLowerCase();
  return rows.filter(x=>{
    const queryOk=!q||text(x).toLowerCase().includes(q);
    const filterOk=Object.entries(state.filters).every(([field,wanted])=>{
      const v=x?.[field];
      return Array.isArray(v)?v.map(String).includes(String(wanted)):String(v)===String(wanted)
    });
    return queryOk&&filterOk
  })
}
function distinct(rows,field){
  const out=new Set();
  rows.forEach(x=>(Array.isArray(x[field])?x[field]:[x[field]]).forEach(v=>{if(v!=null&&v!==""&&typeof v!=="object")out.add(String(v))}));
  return [...out].slice(0,20)
}
function renderLibrary(view,type){
  if(state.libraryType&&state.libraryType!==type){state.libraryQuery="";state.filters={}}
  state.libraryType=type;
  const meta=DATASET_META[type];
  if(!meta){setRoute("library/heroes");return}
  const rows=state.data[type]||[];
  view.innerHTML=`
    <header class="page-head"><div><div class="eyebrow">LIBRARY</div><h1>资料库</h1><p>统一查找英雄、棋手、装备、天赋、效果牌和机制。当前：${esc(meta.label)}。</p></div></header>
    <nav class="library-tabs">${LIBRARY_TYPES.map(k=>`<a href="#/library/${k}" class="${k===type?"active":""}">${DATASET_META[k].label} <span class="secondary-count">${state.data[k]?.length||0}</span></a>`).join("")}</nav>
    <div class="catalog-tools">
      <label class="inline-search"><input id="librarySearch" value="${esc(state.libraryQuery)}" placeholder="在${esc(meta.label)}中搜索…"></label>
      <button class="filter-toggle" id="filterToggle" type="button">筛选</button>
      <div class="layout-toggle" aria-label="布局"><button type="button" data-layout="list" class="${state.layout==="list"?"active":""}">☷</button><button type="button" data-layout="grid" class="${state.layout==="grid"?"active":""}">▦</button></div>
    </div>
    <div class="filters" id="filters">${renderFilters(type,rows)}</div>
    <div class="result-count" id="resultCount"></div>
    <div id="catalogResults"></div>
  `;
  $("#librarySearch").addEventListener("input",e=>{state.libraryQuery=e.target.value;renderLibraryResults(type)});
  $("#filterToggle").addEventListener("click",()=>$("#filters").classList.toggle("open"));
  $$("[data-layout]").forEach(b=>b.addEventListener("click",()=>{state.layout=b.dataset.layout;localStorage.setItem("wxq-layout",state.layout);renderLibraryResults(type);$$("[data-layout]").forEach(x=>x.classList.toggle("active",x===b))}));
  bindFilterButtons(type);
  renderLibraryResults(type)
}
function renderFilters(type,rows){
  const groups=[];
  for(const [field,label] of DATASET_META[type].filters||[]){
    const vals=distinct(rows,field);
    if(vals.length>1&&vals.length<=20){
      groups.push(`<div class="filter-group"><span class="filter-label">${label}</span>${vals.map(v=>`<button class="chip ${String(state.filters[field])===v?"active":""}" data-filter-field="${esc(field)}" data-filter-value="${esc(v)}">${esc(v)}</button>`).join("")}</div>`)
    }
  }
  return groups.join("")
}
function bindFilterButtons(type){
  $$("[data-filter-field]").forEach(b=>b.addEventListener("click",()=>{
    const f=b.dataset.filterField,v=b.dataset.filterValue;
    if(String(state.filters[f])===v)delete state.filters[f]; else state.filters[f]=v;
    $("#filters").innerHTML=renderFilters(type,state.data[type]||[]);
    bindFilterButtons(type);renderLibraryResults(type)
  }))
}
function renderLibraryResults(type){
  const rows=libraryFiltered(type),box=$("#catalogResults");
  $("#resultCount").textContent=`${rows.length} 条结果`;
  if(!rows.length){
    box.innerHTML=`<div class="empty-state"><strong>没有找到匹配资料</strong><p>清除筛选或换一个关键词试试。</p></div>`;return
  }
  if(state.layout==="grid"){
    box.innerHTML=`<div class="atlas-grid">${rows.map(x=>`<article class="atlas-card" data-entity="${entityRoute(type,x)}"><div class="atlas-image"><span class="fallback">${firstGlyph(x)}</span>${assetUrl(x.img||x.avatar)?`<img src="${esc(assetUrl(x.img||x.avatar))}" alt="" loading="lazy" data-fallback>`:""}</div><div class="atlas-body"><strong>${esc(nameOf(x))}</strong><small>${esc(tagsFor(x).join(" · "))}</small></div></article>`).join("")}</div>`
  }else{
    box.innerHTML=`<div class="record-list">${rows.map(x=>recordRow(type,x)).join("")}</div>`
  }
  $$("[data-entity]").forEach(el=>el.addEventListener("click",()=>location.hash=el.dataset.entity))
}
function recordRow(type,x){
  return `<article class="record-row" data-entity="${entityRoute(type,x)}">
    <div class="record-identity">${thumb(x)}<div class="record-name"><strong>${esc(nameOf(x))}</strong><small>${esc(typeLabel(type))}</small></div></div>
    <div class="record-desc">${highlighted(descOf(x))}</div>
    <div class="tag-row">${tagsFor(x).filter(t=>!String(t).includes("阶")).slice(0,4).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
    <div class="record-tier">${esc(qLabel(x.quality||x.tier))}</div>
  </article>`
}
function renderComps(view){
  const rows=(state.data.comps||[]).filter(c=>state.compCamp==="全部"||(c.camps||[]).includes(state.compCamp));
  const camps=["全部",...(state.data.camps||[]).map(c=>c.name)];
  view.innerHTML=`
    <header class="page-head"><div><div class="eyebrow">COMPOSITIONS</div><h1>阵容</h1><p>先看核心、成型期和站位，再进入完整阵容。当前收录 ${state.data.comps?.length||0} 套。</p></div></header>
    <div class="filters open" style="margin-top:14px"><div class="filter-group"><span class="filter-label">阵营</span>${camps.map(c=>`<button class="chip ${c===state.compCamp?"active":""}" data-comp-camp="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <div class="result-count">${rows.length} 套阵容</div>
    <div class="comp-list">${rows.map(compRow).join("")}</div>
  `;
  $$("[data-comp-camp]").forEach(b=>b.addEventListener("click",()=>{state.compCamp=b.dataset.compCamp;renderComps(view)}));
  $$("[data-comp]").forEach(el=>el.addEventListener("click",()=>location.hash=el.dataset.comp))
}
function compRow(c){
  return `<article class="comp-row" data-comp="${compRoute(c)}">
    <div class="comp-title"><strong>${esc(c.name)}</strong><small>${esc((c.camps||[]).join(" / "))} · ${esc(c.classificationLabel||"阵容")}</small></div>
    <div class="core-heroes">${(c.core||[]).slice(0,3).map(n=>miniHero(n)).join("")}</div>
    ${boardHtml(c.board,"board-mini")}
    <div class="comp-meta"><strong>${esc(c.timing||"")}</strong><small>${(c.heroes||[]).length} 名成员</small></div>
  </article>`
}
function miniHero(name){
  const h=(state.data.heroes||[]).find(x=>x.name===name)||{name};
  return `<div class="mini-hero">${thumb(h)}<span>${esc(name)}</span></div>`
}
function boardHtml(board,cls){
  const heroMap=new Map((state.data.heroes||[]).map(h=>[String(h.id),h]));
  const cells=(board||Array.from({length:4},()=>Array(7).fill(null))).flat();
  return `<div class="${cls}">${cells.map(id=>{
    if(!id)return '<div class="board-cell"></div>';
    const h=heroMap.get(String(id));
    const src=h?assetUrl(h.img):"";
    return `<div class="board-cell" title="${esc(h?.name||id)}">${src?`<img src="${esc(src)}" alt="${esc(h?.name||"")}" loading="lazy" data-fallback>`:""}</div>`
  }).join("")}</div>`
}
function renderCompDetail(view,id){
  const c=(state.data.comps||[]).find(x=>String(x.id)===String(id));
  if(!c){view.innerHTML=notFound("没有找到这个阵容");return}
  const heroMap=new Map((state.data.heroes||[]).map(h=>[String(h.id),h]));
  const equipMap=new Map((state.data.equips||[]).map(x=>[String(x.id),x]));
  const talentMap=new Map((state.data.talents||[]).map(x=>[String(x.id),x]));
  view.innerHTML=`
    <div class="detail-page">
      <a class="back-link" href="#/comps">← 返回阵容</a>
      <header class="entity-hero">
        <div class="entity-image" style="display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr)">${(c.core||[]).slice(0,4).map(n=>{const h=(state.data.heroes||[]).find(x=>x.name===n);return h&&assetUrl(h.img)?`<img src="${esc(assetUrl(h.img))}" alt="" data-fallback style="position:relative;width:100%;height:100%;object-fit:cover">`: `<span>${esc(n?.[0]||"·")}</span>`}).join("")}</div>
        <div class="entity-head"><div class="eyebrow">COMPOSITION</div><h1>${esc(c.name)}</h1><p>${esc(c.desc||`${(c.core||[]).join(" + ")} 为核心的 ${(c.camps||[]).join(" / ")} 阵容。`)}</p><div class="entity-tags">${[...(c.camps||[]),c.timing,c.classificationLabel].filter(Boolean).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div></div>
      </header>
      <div class="detail-grid">
        <div>
          <section class="detail-section"><h2>站位</h2>${boardHtml(c.board,"board-large")}</section>
          <section class="detail-section"><h2>成员</h2><div class="relationship-list">${(c.heroes||[]).map(n=>{const h=(state.data.heroes||[]).find(x=>x.name===n)||{name:n};return `<div class="relationship-row" data-entity="${entityRoute("heroes",h)}">${thumb(h)}<div><strong>${esc(n)}</strong><small>${esc(h.camp||"")} ${esc(qLabel(h.quality))} ${esc(h.role||"")}</small></div></div>`}).join("")}</div></section>
        </div>
        <div>
          <section class="detail-section"><h2>核心</h2><div class="relationship-list">${(c.core||[]).map(n=>{const h=(state.data.heroes||[]).find(x=>x.name===n)||{name:n};return `<div class="relationship-row" data-entity="${entityRoute("heroes",h)}">${thumb(h)}<div><strong>${esc(n)}</strong><small>核心英雄</small></div></div>`}).join("")}</div></section>
          <section class="detail-section"><h2>装备与天赋样本</h2><div class="relationship-list">${compAssignments(c,heroMap,equipMap,talentMap)}</div></section>
        </div>
      </div>
    </div>
  `;
  $$("[data-entity]").forEach(el=>el.addEventListener("click",()=>location.hash=el.dataset.entity))
}
function compAssignments(c,heroMap,equipMap,talentMap){
  const ids=[...new Set([...Object.keys(c.equips||{}),...Object.keys(c.talents||{})])];
  return ids.slice(0,12).map(id=>{
    const h=heroMap.get(String(id));if(!h)return"";
    const equips=(c.equips?.[id]||[]).map(x=>equipMap.get(String(x))?.name).filter(Boolean);
    const talents=(c.talents?.[id]||[]).map(x=>talentMap.get(String(x))?.name).filter(Boolean);
    return `<div class="relationship-row">${thumb(h)}<div><strong>${esc(h.name)}</strong><small>${esc([...equips,...talents].join(" · ")||"暂无标记")}</small></div></div>`
  }).join("")
}
function relationForHero(hero){
  const comps=(state.data.comps||[]).filter(c=>(c.heroes||[]).includes(hero.name));
  const equipFreq=new Map(),talentFreq=new Map();
  comps.forEach(c=>{
    (c.equips?.[String(hero.id)]||[]).forEach(id=>equipFreq.set(String(id),(equipFreq.get(String(id))||0)+1));
    (c.talents?.[String(hero.id)]||[]).forEach(id=>talentFreq.set(String(id),(talentFreq.get(String(id))||0)+1))
  });
  const rank=(map,type)=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,count])=>({item:findById(type,id),count})).filter(x=>x.item);
  return{comps:comps.slice(0,6),equips:rank(equipFreq,"equips"),talents:rank(talentFreq,"talents")}
}
function renderEntityDetail(view,type,id){
  if(!state.data[type]){view.innerHTML=notFound("资料类型不存在");return}
  const x=findById(type,id);
  if(!x){view.innerHTML=notFound("没有找到这条资料");return}
  if(type==="heroes"){renderHeroDetail(view,x);return}
  renderGenericDetail(view,type,x)
}
function renderHeroDetail(view,h){
  const rel=relationForHero(h);
  const stats=[["生命",h.hp],["攻击",h.atk],["防御",h.def],["攻速",h.aspd],["法力",h.energy]];
  view.innerHTML=`
    <div class="detail-page">
      <a class="back-link" href="#/library/heroes">← 返回英雄</a>
      <header class="entity-hero">
        <div class="entity-image"><span>${firstGlyph(h)}</span>${assetUrl(h.img)?`<img src="${esc(assetUrl(h.img))}" alt="${esc(h.name)}" data-fallback>`:""}</div>
        <div class="entity-head"><div class="eyebrow">HERO</div><h1>${esc(h.name)}</h1><p>${esc(h.camp)} · ${esc(qLabel(h.quality))} · ${esc(h.role||"")}</p><div class="entity-tags">${[...(h.kw||[]),h.camp,h.role].filter(Boolean).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div></div>
      </header>
      <section class="primary-effect"><small>核心卡牌效果</small><p>${highlighted(h.desc)}</p></section>
      <div class="detail-grid">
        <div>
          <section class="detail-section"><h2>战斗技能</h2>${(h.skills||[]).map(s=>`<div class="skill-row"><strong>${esc(s.name)}</strong><p>${highlighted(s.desc)}</p></div>`).join("")||'<div class="skill-row"><p>暂无技能资料。</p></div>'}</section>
          <section class="detail-section"><h2>基础属性</h2><div class="stat-table">${stats.filter(([,v])=>v!=null).map(([k,v])=>`<div class="stat-row"><span>${k}</span><strong>${esc(v)}</strong></div>`).join("")}</div></section>
          <section class="detail-section technical"><h2>技术数据</h2><details><summary>查看原始结构化字段</summary><div class="raw">${esc(JSON.stringify(h,null,2))}</div></details></section>
        </div>
        <div>
          <section class="detail-section"><h2>常见装备</h2>${relationList(rel.equips,"equips","在阵容样本中出现")}</section>
          <section class="detail-section"><h2>相关天赋</h2>${relationList(rel.talents,"talents","在阵容样本中出现")}</section>
          <section class="detail-section"><h2>相关阵容</h2><div class="related-comps">${rel.comps.length?rel.comps.map(c=>`<a class="related-comp" href="${compRoute(c)}"><strong>${esc(c.name)}</strong><span>${esc(c.timing||"")}</span></a>`).join(""):'<div class="skill-row"><p>当前阵容样本中暂无记录。</p></div>'}</div></section>
        </div>
      </div>
    </div>
  `;
  $$("[data-related]").forEach(el=>el.addEventListener("click",()=>location.hash=el.dataset.related))
}
function relationList(rows,type,label){
  if(!rows.length)return'<div class="skill-row"><p>当前阵容样本中暂无稳定记录。</p></div>';
  return `<div class="relationship-list">${rows.map(({item,count})=>`<div class="relationship-row" data-related="${entityRoute(type,item)}">${thumb(item)}<div><strong>${esc(nameOf(item))}</strong><small>${label}</small></div><span class="relationship-count">${count} 次</span></div>`).join("")}</div>`
}
function renderGenericDetail(view,type,x){
  const basics=Object.entries(x).filter(([k,v])=>!["id","name","title","desc","description","summary","text","img","avatar","skills","skill","miji","exclusive"].includes(k)&&v!=null&&["string","number","boolean"].includes(typeof v)).slice(0,10);
  const abilities=[x.skill,x.miji,x.exclusive].filter(Boolean);
  view.innerHTML=`
    <div class="detail-page">
      <a class="back-link" href="#/library/${type}">← 返回${esc(typeLabel(type))}</a>
      <header class="entity-hero">
        <div class="entity-image"><span>${firstGlyph(x)}</span>${assetUrl(x.img||x.avatar)?`<img src="${esc(assetUrl(x.img||x.avatar))}" alt="${esc(nameOf(x))}" data-fallback>`:""}</div>
        <div class="entity-head"><div class="eyebrow">${esc(typeLabel(type).toUpperCase())}</div><h1>${esc(nameOf(x))}</h1><p>${esc(tagsFor(x).join(" · "))}</p><div class="entity-tags">${tagsFor(x).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div></div>
      </header>
      ${descOf(x)?`<section class="primary-effect"><small>核心效果</small><p>${highlighted(descOf(x))}</p></section>`:""}
      <div class="detail-grid"><div>
        ${abilities.length?`<section class="detail-section"><h2>能力</h2>${abilities.map(a=>`<div class="skill-row"><strong>${esc(a.t||a.name||"能力")}</strong><p>${highlighted(a.d||a.desc||"")}</p></div>`).join("")}</section>`:""}
        ${basics.length?`<section class="detail-section"><h2>资料</h2><div class="stat-table">${basics.map(([k,v])=>`<div class="stat-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div></section>`:""}
        <section class="detail-section technical"><h2>技术数据</h2><details><summary>查看原始结构化字段</summary><div class="raw">${esc(JSON.stringify(x,null,2))}</div></details></section>
      </div><div><section class="detail-section"><h2>快速搜索</h2><div class="keyword-cloud">${KEYWORDS.filter(k=>text(x).includes(k)).map(k=>`<button class="keyword-button" data-detail-search="${esc(k)}">${esc(k)}</button>`).join("")||'<span class="tag">暂无关键词</span>'}</div></section></div></div>
    </div>
  `;
  $$("[data-detail-search]").forEach(b=>b.addEventListener("click",()=>openSearch(b.dataset.detailSearch)))
}
function renderVersion(view){
  const p=state.patches.current;
  const diffs=Object.entries(state.manifest.expectedLiveCounts||{}).filter(([k,n])=>(state.data[k]?.length||0)!==n);
  view.innerHTML=`
    <header class="page-head"><div><div class="eyebrow">PATCH HISTORY</div><h1>版本</h1><p>当前游戏版本、实体改动与资料同步状态。</p></div></header>
    <section class="section"><div class="section-title-row"><div><h2>v${esc(p.version)} · ${esc(p.date)}</h2><p>当前版本摘要</p></div></div><div class="timeline">${(p.changes||[]).map(c=>`<div class="timeline-row"><div class="timeline-kind">${esc(c.kind)}</div><div class="timeline-name">${esc(c.name)}</div><div class="timeline-desc">${esc(c.summary)}</div></div>`).join("")}</div></section>
    <section class="section"><div class="section-title-row"><div><h2>资料状态</h2><p>自动快照与当前参考数量的差异。</p></div></div><div class="tool-list">${diffs.length?diffs.map(([k,n])=>`<div class="tool-row"><div><strong>${esc(typeLabel(k))}</strong></div><div><p>仓库快照 ${state.data[k]?.length||0} · 当前参考 ${n}</p></div><div class="tool-state">待同步</div></div>`).join(""):'<div class="tool-row"><div><strong>结构化数据</strong></div><div><p>当前参考数量已对齐。</p></div><div class="tool-state">正常</div></div>'}</div></section>
  `
}
function renderTools(view){
  view.innerHTML=`
    <header class="page-head"><div><div class="eyebrow">TOOLS</div><h1>工具</h1><p>先把已经有可靠数据支撑的能力做成工具，后续再加入构筑器、Diff 和截图识别。</p></div></header>
    <section class="section"><div class="section-title-row"><div><h2>机制关系检索</h2><p>点击关键词，跨英雄、天赋、效果牌和机制搜索。</p></div></div><div class="keyword-cloud">${KEYWORDS.map(k=>`<button class="keyword-button" data-tool-search="${esc(k)}">${esc(k)} · ${keywordCount(k)}</button>`).join("")}</div></section>
    <section class="section"><div class="section-title-row"><div><h2>路线</h2><p>新工具必须进入既有产品结构，不扩散一级导航。</p></div></div><div class="tool-list">
      <div class="tool-row"><div><strong>阵容构筑器</strong></div><div><p>拖拽站位、装备与天赋，复用现有英雄和阵容数据。</p></div><div class="tool-state">规划</div></div>
      <div class="tool-row"><div><strong>版本 Entity Diff</strong></div><div><p>按英雄、装备、天赋查看版本前后变化，而不是只读 patch 文本。</p></div><div class="tool-state">规划</div></div>
      <div class="tool-row"><div><strong>截图识别</strong></div><div><p>从对局截图识别英雄与装备，再连接关系和阵容建议。</p></div><div class="tool-state">后续</div></div>
    </div></section>
  `;
  $$("[data-tool-search]").forEach(b=>b.addEventListener("click",()=>openSearch(b.dataset.toolSearch)))
}
function renderMore(view){
  view.innerHTML=`
    <header class="page-head"><div><div class="eyebrow">MORE</div><h1>更多</h1><p>版本、工具、主题和项目来源。</p></div></header>
    <div class="more-list">
      <a class="more-link" href="#/version"><span>版本记录</span><span>→</span></a>
      <a class="more-link" href="#/tools"><span>工具</span><span>→</span></a>
      <a class="more-link" href="https://github.com/qbjsdsb/-" target="_blank" rel="noopener"><span>GitHub</span><span>↗</span></a>
      <button class="more-link" id="mobileTheme" type="button" style="width:100%;background:none;color:inherit;border-left:0;border-right:0;border-top:0"><span>切换主题</span><span>◐</span></button>
    </div>
  `;
  $("#mobileTheme").addEventListener("click",()=>{$("#themeButton").click()})
}
function notFound(msg){return `<div class="empty-state"><strong>${esc(msg)}</strong><p><a href="#/home">返回首页</a></p></div>`}
boot();
