const DATASET_META={
  heroes:{label:"英雄",subtitle:"按阵营、品阶与定位筛选",filters:[["camp","阵营"],["quality","品阶"],["role","定位"]]},
  players:{label:"棋手",subtitle:"技能、秘技与专属牌",filters:[]},
  equips:{label:"装备",subtitle:"按类别、方向与阵营筛选",filters:[["quality","品阶"],["cls","类别"],["kind","方向"],["cat","阵营"]]},
  talents:{label:"天赋",subtitle:"按品阶、天赋包与出现轮次筛选",filters:[["quality","品阶"],["grp","来源"],["stage","轮次"]]},
  effects:{label:"效果牌",subtitle:"通用与阵营专属效果",filters:[["quality","品阶"],["cat","类型"]]},
  comps:{label:"阵容",subtitle:"阵容核心、成员与成型节奏",filters:[["timing","成型期"],["classificationLabel","分类"],["camps","阵营"]]},
  buffs:{label:"机制",subtitle:"关键词与体系联动",filters:[["kind","类型"],["camp","阵营"]]},
  tips:{label:"冷知识",subtitle:"容易忽略的规则与交互",filters:[["cat","类型"]]},
  news:{label:"资讯",subtitle:"版本更新与官方信息索引",filters:[["cat","类型"]]}
};
const KEYWORDS=["登场","整备","开团","牺牲","退场","凯旋","败阵","夺取","闪现","复生","图腾","临时等级","永久等级","觉醒","召唤","古币","合成","装备"];
const state={manifest:null,patches:null,data:{},section:"heroes",query:"",filters:{},layout:localStorage.getItem("wxq-layout")||"list",theme:localStorage.getItem("wxq-theme")||"auto"};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const text=v=>{if(v==null)return"";if(["string","number","boolean"].includes(typeof v))return String(v);if(Array.isArray(v))return v.map(text).join(" ");if(typeof v==="object")return Object.values(v).map(text).join(" ");return""};
const nameOf=x=>x?.name||x?.title||x?.id||"未命名";
const descOf=x=>x?.desc||x?.description||x?.summary||x?.text||x?.skill?.d||x?.note||"";
const qLabel=q=>q==null||q===""?"":(/阶|T\d/i.test(String(q))?String(q):String(q)+"阶");
const labelMap={hp:"生命",atk:"攻击",def:"防御",aspd:"攻速",energy:"法力",camp:"阵营",quality:"品阶",role:"定位",cls:"类别",kind:"方向",cat:"类型",stage:"轮次",grp:"来源",timing:"成型期",classificationLabel:"分类"};

function normalise(raw,key){if(Array.isArray(raw))return raw;if(!raw||typeof raw!=="object")return[];if(Array.isArray(raw[key]))return raw[key];if(key==="buffs"&&Array.isArray(raw.groups))return raw.groups.flatMap(g=>Array.isArray(g.items)?g.items.map(x=>({...x,kind:x.kind||g.kind||g.name})): [g]);const arrays=Object.values(raw).filter(Array.isArray);if(arrays.length===1)return arrays[0];return Object.entries(raw).filter(([,v])=>v&&typeof v==="object"&&!Array.isArray(v)).map(([id,v])=>({id,...v}))}
function mergeOverrides(base,overrides){const rows=[...base];for(const patch of overrides||[]){const key=patch.id??patch.name;const i=rows.findIndex(x=>(x.id??x.name)===key);if(i>=0)rows[i]={...rows[i],...patch};else rows.push(patch)}return rows}
async function getJson(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(r.status+" "+r.statusText);return r.json()}
function highlighted(v){let s=esc(text(v));for(const k of KEYWORDS)s=s.replaceAll(k,`<span class="keyword">${k}</span>`);return s}
function firstGlyph(v){const s=nameOf(v);return esc([...s][0]||"·")}
function closeNav(){$("#rail").classList.remove("open");document.body.classList.remove("nav-open")}
function openNav(){$("#rail").classList.add("open");document.body.classList.add("nav-open")}

async function boot(){
  bind();applyTheme();
  try{
    state.manifest=await getJson("./data/manifest.json");
    state.patches=await getJson(state.manifest.patches);
    const overrides=await getJson(state.manifest.overrides);
    await Promise.all(Object.entries(state.manifest.datasets).map(async([key,url])=>{state.data[key]=mergeOverrides(normalise(await getJson(url),key),overrides[key])}));
    renderAll();
  }catch(e){toast("资料加载失败："+e.message);$("#health").textContent="资料加载失败，请稍后刷新。"}
}
function bind(){
  $("#menuButton").addEventListener("click",()=>$("#rail").classList.contains("open")?closeNav():openNav());
  $("#railClose").addEventListener("click",closeNav);
  $("#railBackdrop").addEventListener("click",closeNav);
  $("#themeButton").addEventListener("click",()=>{state.theme=state.theme==="dark"?"light":"dark";localStorage.setItem("wxq-theme",state.theme);applyTheme()});
  $("#searchInput").addEventListener("input",e=>{state.query=e.target.value.trim();renderCatalog()});
  $("#detailClose").addEventListener("click",()=>$("#detailDialog").close());
  $("#detailDialog").addEventListener("click",e=>{if(e.target===$("#detailDialog"))$("#detailDialog").close()});
  $("#filterToggle").addEventListener("click",()=>{$("#filters").classList.toggle("open");$("#filterToggle").classList.toggle("active")});
  $("#healthMore").addEventListener("click",()=>toast(healthText()));
  $$("[data-layout]").forEach(b=>b.addEventListener("click",()=>{state.layout=b.dataset.layout;localStorage.setItem("wxq-layout",state.layout);renderCatalog()}));
  document.addEventListener("keydown",e=>{
    if(e.key==="/"&&document.activeElement!==$("#searchInput")){e.preventDefault();$("#searchInput").focus()}
    if(e.key==="Escape"){if($("#detailDialog").open)$("#detailDialog").close();closeNav()}
  });
}
function applyTheme(){const dark=state.theme==="auto"?matchMedia("(prefers-color-scheme: dark)").matches:state.theme==="dark";document.documentElement.dataset.theme=dark?"dark":"light"}
function renderAll(){renderNav();renderHeader();renderMetrics();renderHealth();renderCatalog();renderPatches();renderSource()}
function renderNav(){
  $("#nav").innerHTML=Object.entries(DATASET_META).map(([k,m])=>`<button class="${k===state.section?"active":""}" data-section="${k}"><span>${m.label}</span><span class="nav-count">${state.data[k]?.length||0}</span></button>`).join("");
  $$("#nav [data-section]").forEach(b=>b.addEventListener("click",()=>{state.section=b.dataset.section;state.query="";state.filters={};$("#searchInput").value="";renderNav();renderCatalog();closeNav();document.querySelector("#catalog").scrollIntoView({behavior:"smooth",block:"start"})}));
}
function renderHeader(){$("#versionText").textContent=`v${state.manifest.gameVersion} · ${state.manifest.gameVersionDate}`}
function renderMetrics(){const keys=[["heroes","英雄"],["players","棋手"],["equips","装备"],["talents","天赋"]];$("#metrics").innerHTML=keys.map(([k,l])=>`<div class="metric"><strong>${state.data[k]?.length||0}</strong><span>${l}</span></div>`).join("")}
function healthDiffs(){const expected=state.manifest.expectedLiveCounts||{};return Object.entries(expected).filter(([k,n])=>(state.data[k]?.length||0)!==n)}
function healthText(){const diffs=healthDiffs();return diffs.length?`当前有 ${diffs.length} 项快照待同步：${diffs.map(([k,n])=>`${DATASET_META[k]?.label||k} ${state.data[k]?.length||0}/${n}`).join("，")}`:"结构化快照与当前参考数量一致。"}
function renderHealth(){const diffs=healthDiffs(),el=$("#health");el.className="health"+(diffs.length?" warning":"");el.innerHTML=diffs.length?`<span>资料快照有 ${diffs.length} 项待同步</span><span>·</span><span>${diffs.map(([k,n])=>`${DATASET_META[k]?.label||k} ${state.data[k]?.length||0}/${n}`).join(" · ")}</span>`:`<span>资料快照已与当前参考数量对齐</span>`}
function values(items,field){const s=new Set();for(const x of items){const v=x?.[field];(Array.isArray(v)?v:[v]).forEach(y=>{if(y!=null&&y!==""&&typeof y!=="object")s.add(String(y))})}return[...s].slice(0,18)}
function matchesFilter(x,field,wanted){const v=x?.[field];return Array.isArray(v)?v.map(String).includes(wanted):String(v)===wanted}
function filtered(){if(state.query){const q=state.query.toLowerCase();return Object.entries(state.data).flatMap(([type,rows])=>(rows||[]).map(x=>({...x,__type:type}))).filter(x=>text(x).toLowerCase().includes(q)).slice(0,300)}return(state.data[state.section]||[]).filter(x=>Object.entries(state.filters).every(([f,v])=>matchesFilter(x,f,v)))}
function renderCatalog(){
  const search=Boolean(state.query),meta=DATASET_META[state.section];$("#sectionTitle").textContent=search?`搜索 “${state.query}”`:meta.label;$("#sectionSubtitle").textContent=search?"跨全部资料类型":meta.subtitle;
  const base=search?[]:(state.data[state.section]||[]),groups=[];
  if(!search)for(const[f,l]of meta.filters){const vs=values(base,f);if(vs.length>1&&vs.length<=18)groups.push(`<div class="filter-group"><span class="filter-label">${l}</span>${vs.map(v=>`<button class="chip ${state.filters[f]===v?"active":""}" data-field="${esc(f)}" data-value="${esc(v)}">${esc(v)}</button>`).join("")}</div>`)}
  $("#filters").innerHTML=groups.join("");$("#filterToggle").style.display=groups.length?"":"none";
  $$("#filters [data-field]").forEach(b=>b.addEventListener("click",()=>{const{field,value}=b.dataset;state.filters[field]===value?delete state.filters[field]:state.filters[field]=value;renderCatalog()}));
  const rows=filtered();$("#resultMeta").textContent=`${rows.length} 条结果`;const box=$("#records");box.className="records"+(state.layout==="grid"?" grid":"");$$("[data-layout]").forEach(b=>b.classList.toggle("active",b.dataset.layout===state.layout));
  box.innerHTML=rows.map((x,i)=>recordHtml(x,search?x.__type:state.section,i)).join("");$("#empty").classList.toggle("hidden",rows.length>0);
  $$("#records [data-index]").forEach(r=>r.addEventListener("click",()=>{const x=rows[Number(r.dataset.index)];openDetail(x,search?x.__type:state.section)}))
}
function recordHtml(x,type,i){
  const tags=[x.camp,x.cat,x.kind,x.cls,x.role,x.grp,x.timing,x.classificationLabel].flatMap(v=>Array.isArray(v)?v:[v]).filter(Boolean).slice(0,4);
  return`<article class="record" data-index="${i}">
    <div class="record-main"><div class="record-glyph">${firstGlyph(x)}</div><div><div class="record-type">${esc(DATASET_META[type]?.label||type)}</div><div class="record-title">${esc(nameOf(x))}</div></div></div>
    <div class="record-desc">${highlighted(descOf(x))}</div>
    <div class="tags">${tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
    <div class="quality">${esc(qLabel(x.quality||x.tier))}</div>
  </article>`
}
function tagsFor(x){return [qLabel(x.quality||x.tier),x.camp,x.role,x.kind,x.cls,x.cat,x.grp,x.timing,x.classificationLabel].flatMap(v=>Array.isArray(v)?v:[v]).filter(Boolean).slice(0,6)}
function statHtml(items){return items.filter(([,v])=>v!=null&&v!=="").map(([k,v])=>`<div class="stat"><span>${esc(labelMap[k]||k)}</span><b>${esc(v)}</b></div>`).join("")}
function skillHtml(skills){return skills.map(s=>`<div class="skill"><strong>${esc(s.name||s.t||"技能")}</strong><p>${highlighted(s.desc||s.d||s.text||"")}</p></div>`).join("")}
function heroDetail(x){
  const stats=[["camp",x.camp],["quality",qLabel(x.quality)],["role",x.role],["hp",x.hp],["atk",x.atk],["def",x.def],["aspd",x.aspd],["energy",x.energy]];
  const skills=Array.isArray(x.skills)?x.skills:[];
  return `${descOf(x)?`<div class="detail-lead">${highlighted(descOf(x))}</div>`:""}
    ${skills.length?`<div class="detail-section"><h3>战斗技能</h3><div class="skill-list">${skillHtml(skills)}</div></div>`:""}
    <div class="detail-section"><h3>基础属性</h3><div class="stat-grid">${statHtml(stats)}</div></div>
    ${Array.isArray(x.kw)&&x.kw.length?`<div class="detail-section"><h3>关联关键词</h3><div class="detail-tags">${x.kw.map(k=>`<span class="tag">${esc(k)}</span>`).join("")}</div></div>`:""}`;
}
function playerDetail(x){
  const blocks=[x.skill,x.miji,x.exclusive].filter(Boolean);
  return `${x.line?`<div class="detail-lead">“${esc(x.line)}”</div>`:""}${blocks.length?`<div class="detail-section"><h3>棋手能力</h3><div class="skill-list">${skillHtml(blocks)}</div></div>`:""}`;
}
function compDetail(x){
  const core=Array.isArray(x.core)?x.core:text(x.core);const heroes=Array.isArray(x.heroes)?x.heroes:[];
  return `${descOf(x)?`<div class="detail-lead">${highlighted(descOf(x))}</div>`:""}
    <div class="detail-section"><h3>阵容概况</h3><div class="stat-grid">${statHtml([["timing",x.timing],["classificationLabel",x.classificationLabel],["核心",core],["阵营",Array.isArray(x.camps)?x.camps.join(" / "):x.camps]])}</div></div>
    ${heroes.length?`<div class="detail-section"><h3>阵容成员</h3><div class="detail-tags">${heroes.map(h=>`<span class="tag">${esc(typeof h==="string"?h:(h.name||h.hero||text(h)))}</span>`).join("")}</div></div>`:""}`;
}
function genericDetail(x){
  const skip=new Set(["name","title","desc","description","summary","text","__type","img","avatar"]);
  const basic=Object.entries(x).filter(([k,v])=>!skip.has(k)&&v!=null&&["string","number","boolean"].includes(typeof v)).slice(0,12);
  const structured=Object.entries(x).filter(([k,v])=>!skip.has(k)&&v&&typeof v==="object");
  return `${descOf(x)?`<div class="detail-lead">${highlighted(descOf(x))}</div>`:""}${basic.length?`<div class="detail-section"><h3>资料</h3><div class="stat-grid">${statHtml(basic)}</div></div>`:""}${structured.length?`<div class="detail-section"><details><summary>查看结构化原始字段</summary><div class="raw">${esc(JSON.stringify(Object.fromEntries(structured),null,2))}</div></details></div>`:""}`;
}
function openDetail(x,type){
  const d=$("#detailBody"),tags=tagsFor(x);
  let body=type==="heroes"?heroDetail(x):type==="players"?playerDetail(x):type==="comps"?compDetail(x):genericDetail(x);
  d.innerHTML=`<div class="detail-head"><div class="detail-sub">${esc(DATASET_META[type]?.label||type)}</div><h2>${esc(nameOf(x))}</h2>${tags.length?`<div class="detail-tags">${tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>`:""}</div>${body}`;
  $("#detailDialog").showModal()
}
function renderPatches(){const p=state.patches.current;$("#patchMeta").textContent=`v${p.version} · ${p.date}`;$("#patchGrid").innerHTML=(p.changes||[]).map(c=>`<article class="patch"><div class="patch-kind">${esc(c.kind)}</div><h3>${esc(c.name)}</h3><p>${esc(c.summary)}</p></article>`).join("")}
function renderSource(){const u=state.manifest.upstream;$("#sourceNote").innerHTML=`基础结构化数据快照：${esc(state.manifest.catalogSnapshotDate)} · 上游 <a href="https://github.com/${esc(u.repository)}" target="_blank" rel="noopener">${esc(u.name)}</a>。人工核验修正与版本补丁独立保存。本站为非官方玩家资料工具，与腾讯游戏无隶属关系。`}
function toast(m){const e=$("#toast");e.textContent=m;e.classList.remove("hidden");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add("hidden"),3200)}
boot();
