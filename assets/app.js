const DATASET_META={
  heroes:{label:"英雄",subtitle:"按阵营、品阶与关键词筛选",filters:[["camp","阵营"],["quality","品阶"],["role","定位"]]},
  players:{label:"棋手",subtitle:"棋手技能、秘技与专属牌",filters:[]},
  equips:{label:"装备",subtitle:"基础、普通、特殊与阵营装备",filters:[["quality","品阶"],["cls","类别"],["kind","方向"],["cat","阵营"]]},
  talents:{label:"天赋",subtitle:"按品阶、天赋包与出现轮次筛选",filters:[["quality","品阶"],["grp","来源"],["stage","轮次"]]},
  effects:{label:"效果牌",subtitle:"通用与阵营专属效果",filters:[["quality","品阶"],["cat","类型"]]},
  comps:{label:"阵容",subtitle:"社区阵容与构筑信息",filters:[["timing","成型期"],["classificationLabel","分类"],["camps","阵营"]]},
  buffs:{label:"机制",subtitle:"关键词与体系联动",filters:[["kind","类型"],["camp","阵营"]]},
  tips:{label:"冷知识",subtitle:"容易忽略的规则与交互",filters:[["cat","类型"]]},
  news:{label:"资讯",subtitle:"版本更新与官方信息索引",filters:[["cat","类型"]]}
};
const state={manifest:null,patches:null,data:{},section:"heroes",query:"",filters:{},layout:localStorage.getItem("wxq-layout")||"list",theme:localStorage.getItem("wxq-theme")||"auto"};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const text=v=>{if(v==null)return"";if(["string","number","boolean"].includes(typeof v))return String(v);if(Array.isArray(v))return v.map(text).join(" ");if(typeof v==="object")return Object.values(v).map(text).join(" ");return""};
const nameOf=x=>x?.name||x?.title||x?.id||"未命名";
const descOf=x=>x?.desc||x?.description||x?.summary||x?.text||x?.skill?.d||x?.note||"";
const qLabel=q=>q==null||q===""?"":(/阶|T\d/i.test(String(q))?String(q):String(q)+"阶");

function normalise(raw,key){if(Array.isArray(raw))return raw;if(!raw||typeof raw!=="object")return[];if(Array.isArray(raw[key]))return raw[key];if(key==="buffs"&&Array.isArray(raw.groups))return raw.groups.flatMap(g=>Array.isArray(g.items)?g.items.map(x=>({...x,kind:x.kind||g.kind||g.name})): [g]);const arrays=Object.values(raw).filter(Array.isArray);if(arrays.length===1)return arrays[0];return Object.entries(raw).filter(([,v])=>v&&typeof v==="object"&&!Array.isArray(v)).map(([id,v])=>({id,...v}))}
function mergeOverrides(base,overrides){const rows=[...base];for(const patch of overrides||[]){const key=patch.id??patch.name;const i=rows.findIndex(x=>(x.id??x.name)===key);if(i>=0)rows[i]={...rows[i],...patch};else rows.push(patch)}return rows}
async function getJson(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(r.status+" "+r.statusText);return r.json()}

async function boot(){
  bind();
  applyTheme();
  try{
    state.manifest=await getJson("./data/manifest.json");
    state.patches=await getJson(state.manifest.patches);
    const overrides=await getJson(state.manifest.overrides);
    const entries=Object.entries(state.manifest.datasets);
    await Promise.all(entries.map(async([key,url])=>{state.data[key]=mergeOverrides(normalise(await getJson(url),key),overrides[key])}));
    renderAll();
  }catch(e){toast("资料加载失败："+e.message);$("#health").textContent="资料加载失败，请稍后刷新。"}
}
function bind(){
  $("#menuButton").addEventListener("click",()=>$("#rail").classList.toggle("open"));
  $("#themeButton").addEventListener("click",()=>{state.theme=state.theme==="dark"?"light":"dark";localStorage.setItem("wxq-theme",state.theme);applyTheme()});
  $("#searchInput").addEventListener("input",e=>{state.query=e.target.value.trim();renderCatalog()});
  $("#detailClose").addEventListener("click",()=>$("#detailDialog").close());
  $("#detailDialog").addEventListener("click",e=>{if(e.target===$("#detailDialog"))$("#detailDialog").close()});
  $$("[data-layout]").forEach(b=>b.addEventListener("click",()=>{state.layout=b.dataset.layout;localStorage.setItem("wxq-layout",state.layout);renderCatalog()}));
  document.addEventListener("keydown",e=>{if(e.key==="/"&&document.activeElement!==$("#searchInput")){e.preventDefault();$("#searchInput").focus()}if(e.key==="Escape"&&$("#detailDialog").open)$("#detailDialog").close()});
}
function applyTheme(){const dark=state.theme==="auto"?matchMedia("(prefers-color-scheme: dark)").matches:state.theme==="dark";document.documentElement.dataset.theme=dark?"dark":"light"}
function renderAll(){renderNav();renderHeader();renderMetrics();renderHealth();renderCatalog();renderPatches();renderSource()}
function renderNav(){
  $("#nav").innerHTML=Object.entries(DATASET_META).map(([k,m])=>`<button class="${k===state.section?"active":""}" data-section="${k}"><span>${m.label}</span><span class="nav-count">${state.data[k]?.length||0}</span></button>`).join("");
  $$("#nav [data-section]").forEach(b=>b.addEventListener("click",()=>{state.section=b.dataset.section;state.query="";state.filters={};$("#searchInput").value="";renderNav();renderCatalog();$("#rail").classList.remove("open")}));
}
function renderHeader(){$("#versionText").textContent=`v${state.manifest.gameVersion} · ${state.manifest.gameVersionDate}`}
function renderMetrics(){
  const keys=[["heroes","英雄"],["players","棋手"],["equips","装备"],["talents","天赋"]];
  $("#metrics").innerHTML=keys.map(([k,l])=>`<div class="metric"><strong>${state.data[k]?.length||0}</strong><span>${l}</span></div>`).join("")
}
function renderHealth(){
  const expected=state.manifest.expectedLiveCounts||{};const diffs=Object.entries(expected).filter(([k,n])=>(state.data[k]?.length||0)!==n);
  const el=$("#health");el.className="health"+(diffs.length?" warning":"");
  el.innerHTML=diffs.length?`<span>数据快照与当前参考存在 ${diffs.length} 项差异：</span><span>${diffs.map(([k,n])=>`${DATASET_META[k]?.label||k} ${state.data[k]?.length||0}/${n}`).join(" · ")}</span>`:`<span>结构化快照与当前参考数量一致。</span>`
}
function values(items,field){const s=new Set();for(const x of items){const v=x?.[field];(Array.isArray(v)?v:[v]).forEach(y=>{if(y!=null&&y!==""&&typeof y!=="object")s.add(String(y))})}return[...s].slice(0,18)}
function matchesFilter(x,field,wanted){const v=x?.[field];return Array.isArray(v)?v.map(String).includes(wanted):String(v)===wanted}
function filtered(){
  if(state.query){const q=state.query.toLowerCase();return Object.entries(state.data).flatMap(([type,rows])=>(rows||[]).map(x=>({...x,__type:type}))).filter(x=>text(x).toLowerCase().includes(q)).slice(0,300)}
  return(state.data[state.section]||[]).filter(x=>Object.entries(state.filters).every(([f,v])=>matchesFilter(x,f,v)))
}
function renderCatalog(){
  const search=Boolean(state.query),meta=DATASET_META[state.section];$("#sectionTitle").textContent=search?`搜索 “${state.query}”`:meta.label;$("#sectionSubtitle").textContent=search?"跨全部资料类型":meta.subtitle;
  const base=search?[]:(state.data[state.section]||[]);const groups=[];
  if(!search)for(const[f,l]of meta.filters){const vs=values(base,f);if(vs.length>1&&vs.length<=18)groups.push(`<div class="filter-group"><span class="filter-label">${l}</span>${vs.map(v=>`<button class="chip ${state.filters[f]===v?"active":""}" data-field="${esc(f)}" data-value="${esc(v)}">${esc(v)}</button>`).join("")}</div>`)}
  $("#filters").innerHTML=groups.join("");$$("#filters [data-field]").forEach(b=>b.addEventListener("click",()=>{const{field,value}=b.dataset;state.filters[field]===value?delete state.filters[field]:state.filters[field]=value;renderCatalog()}));
  const rows=filtered();$("#resultMeta").textContent=`${rows.length} 条结果`;const box=$("#records");box.className="records"+(state.layout==="grid"?" grid":"");$$("[data-layout]").forEach(b=>b.classList.toggle("active",b.dataset.layout===state.layout));
  box.innerHTML=rows.map((x,i)=>recordHtml(x,search?x.__type:state.section,i)).join("");$("#empty").classList.toggle("hidden",rows.length>0);
  $$("#records [data-index]").forEach(r=>r.addEventListener("click",()=>{const x=rows[Number(r.dataset.index)];openDetail(x,search?x.__type:state.section)}))
}
function recordHtml(x,type,i){
  const tags=[x.camp,x.cat,x.kind,x.cls,x.role,x.grp,x.timing,x.classificationLabel].flatMap(v=>Array.isArray(v)?v:[v]).filter(Boolean).slice(0,4);
  return`<article class="record" data-index="${i}"><div><div class="record-type">${esc(DATASET_META[type]?.label||type)}</div><div class="record-title">${esc(nameOf(x))}</div></div><div class="record-desc">${esc(text(descOf(x)))}</div><div class="tags">${tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div><div class="quality">${esc(qLabel(x.quality||x.tier))}</div></article>`
}
function openDetail(x,type){
  const d=$("#detailBody");const skip=new Set(["name","title","desc","description","summary","text","__type"]);const basic=Object.entries(x).filter(([k,v])=>!skip.has(k)&&v!=null&&["string","number","boolean"].includes(typeof v)).slice(0,12);
  const structured=Object.entries(x).filter(([k,v])=>!skip.has(k)&&v&&typeof v==="object");
  d.innerHTML=`<div class="detail-sub">${esc(DATASET_META[type]?.label||type)}</div><h2>${esc(nameOf(x))}</h2>${descOf(x)?`<div class="detail-section"><h3>说明</h3><div>${esc(text(descOf(x)))}</div></div>`:""}${basic.length?`<div class="detail-section"><h3>属性</h3><div class="kv">${basic.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div></div>`:""}${structured.length?`<div class="detail-section"><h3>详细数据</h3><div class="raw">${esc(JSON.stringify(Object.fromEntries(structured),null,2))}</div></div>`:""}`;
  $("#detailDialog").showModal()
}
function renderPatches(){const p=state.patches.current;$("#patchMeta").textContent=`v${p.version} · ${p.date}`;$("#patchGrid").innerHTML=(p.changes||[]).map(c=>`<article class="patch"><div class="patch-kind">${esc(c.kind)}</div><h3>${esc(c.name)}</h3><p>${esc(c.summary)}</p></article>`).join("")}
function renderSource(){const u=state.manifest.upstream;$("#sourceNote").innerHTML=`基础结构化数据快照：${esc(state.manifest.catalogSnapshotDate)} · 上游 <a href="https://github.com/${esc(u.repository)}" target="_blank" rel="noopener">${esc(u.name)}</a>。人工核验修正与版本补丁独立保存。本站为非官方玩家资料工具，与腾讯游戏无隶属关系。`}
function toast(m){const e=$("#toast");e.textContent=m;e.classList.remove("hidden");setTimeout(()=>e.classList.add("hidden"),3200)}
boot();
