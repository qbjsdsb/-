const KEY_TERMS=["登场","整备","开团","牺牲","退场","凯旋","败阵","夺取","闪现","复生","图腾","临时等级","永久等级","觉醒","召唤","古币","合成","装备"];

const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const pct=v=>`${Math.round(clamp(v)*100)}%`;
const num=(v,d=0)=>Number(v||0).toFixed(d);

function hashSeed(s){
  let h=2166136261>>>0;
  for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0
}
function rngFactory(seed){
  let x=seed||0x9e3779b9;
  return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)/4294967296)}
}
function weightedPick(entries,total,rng){
  let r=rng()*total;
  for(const e of entries){r-=e.remaining;if(r<0)return e}
  return entries[entries.length-1]||null
}
function roleKey(role){
  const r=String(role||"");
  if(/前排|坦|承伤/.test(r))return"front";
  if(/输出|刺客|射手|法师/.test(r))return"damage";
  return"utility"
}
function compositionFeatures(comp,heroMap){
  const members=(comp.heroes||[]).map(n=>heroMap.get(n)).filter(Boolean);
  const cores=(comp.core||[]).map(n=>heroMap.get(n)).filter(Boolean);
  const qualities=members.map(h=>Number(h.quality)||1);
  const coreQualities=cores.map(h=>Number(h.quality)||1);
  const avgQuality=mean(qualities)||1;
  const coreQuality=mean(coreQualities)||avgQuality;
  const roles=new Set(members.map(h=>roleKey(h.role)));
  const roleCoverage=roles.size/3;
  const campCounts=new Map();
  members.forEach(h=>campCounts.set(h.camp,(campCounts.get(h.camp)||0)+1));
  const campFocus=members.length?Math.max(0,...campCounts.values())/members.length:0;
  const repeated=KEY_TERMS.map(k=>members.filter(h=>`${(h.kw||[]).join(" ")} ${h.desc||""}`.includes(k)).length).filter(n=>n>=2);
  const keywordSynergy=clamp(repeated.reduce((a,n)=>a+(n-1),0)/Math.max(4,members.length));
  const assignmentCoverage=members.length?members.filter(h=>(comp.equips?.[String(h.id)]||[]).length||(comp.talents?.[String(h.id)]||[]).length).length/members.length:0;
  const synergy=clamp(0.32*campFocus+0.28*roleCoverage+0.25*keywordSynergy+0.15*assignmentCoverage);
  const tierPower=clamp(((avgQuality-1)/4)*0.45+((coreQuality-1)/4)*0.55);
  const power=clamp(0.68*tierPower+0.18*roleCoverage+0.14*keywordSynergy);
  const lowCost=clamp(1-(avgQuality-1)/4);
  const coreCount=Math.max(1,cores.length);
  const singleCorePenalty=coreCount===1?0.18:coreCount===2?0.06:0;
  const flexibility=clamp(0.5*lowCost+0.25*roleCoverage+0.25*(1-singleCorePenalty));
  const midgame=clamp(0.55*lowCost+0.25*roleCoverage+0.2*campFocus);
  return{members,cores,avgQuality,coreQuality,roleCoverage,campFocus,keywordSynergy,assignmentCoverage,synergy,power,lowCost,flexibility,midgame}
}
function tierTotals(heroes,pool){
  const counts={1:0,2:0,3:0,4:0,5:0};
  heroes.forEach(h=>{const q=Number(h.quality)||1;if(counts[q]!=null)counts[q]++});
  const totals={};
  for(let q=1;q<=5;q++)totals[q]=counts[q]*(pool[q]||0);
  return totals
}
function simulateAvailability(comp,features,state,model,settings){
  const odds=model.shopOdds[String(settings.level)]||model.shopOdds[settings.level]||{};
  const pool=model.inventoryByTier;
  const totals=tierTotals(state.data.heroes||[],pool);
  const targets=features.cores.length?features.cores:features.members.slice(0,1);
  if(!targets.length)return{startup:0,awaken:0,twoCopy:0,avgPrimary:0};
  const trials=settings.simulations;
  const slots=settings.refreshes*5;
  let startup=0,awaken=0,twoCopy=0,primaryCopies=0;
  const seed=hashSeed(`${comp.id}|${settings.level}|${settings.refreshes}|${settings.contested}|${settings.simulations}`);
  const rng=rngFactory(seed);
  for(let t=0;t<trials;t++){
    const entries=targets.map((h,i)=>({i,name:h.name,tier:Number(h.quality)||1,remaining:Math.max(0,(pool[String(h.quality)]||pool[h.quality]||0)-settings.contested),copies:0}));
    const tierTotal={...totals};
    entries.forEach(e=>{tierTotal[e.tier]=Math.max(1,(tierTotal[e.tier]||1)-settings.contested)});
    for(let s=0;s<slots;s++){
      const r=rng();let acc=0,tier=5;
      for(let q=1;q<=5;q++){acc+=Number(odds[String(q)]??odds[q]??0);if(r<acc){tier=q;break}}
      const same=entries.filter(e=>e.tier===tier&&e.remaining>0);
      if(!same.length)continue;
      const targetRemaining=same.reduce((a,e)=>a+e.remaining,0);
      const pTarget=clamp(targetRemaining/Math.max(targetRemaining,tierTotal[tier]||1));
      if(rng()>=pTarget)continue;
      const hit=weightedPick(same,targetRemaining,rng);
      if(!hit)continue;
      hit.remaining--;hit.copies++;tierTotal[tier]=Math.max(1,tierTotal[tier]-1);
    }
    if(entries.every(e=>e.copies>=1))startup++;
    if(entries[0].copies>=2)twoCopy++;
    if(entries[0].copies>=4)awaken++;
    primaryCopies+=entries[0].copies
  }
  return{startup:startup/trials,awaken:awaken/trials,twoCopy:twoCopy/trials,avgPrimary:primaryCopies/trials}
}
function objectiveScore(name,f,a,model){
  const w=model.objectives[name]?.weights||model.objectives.stable.weights;
  const availability=clamp(0.72*a.startup+0.28*a.twoCopy);
  const values={availability,power:f.power,synergy:f.synergy,flexibility:f.flexibility,midgame:f.midgame,lowCost:f.lowCost,ceiling:clamp(0.72*f.power+0.28*a.awaken)};
  let total=0,weight=0;
  Object.entries(w).forEach(([k,v])=>{total+=(values[k]||0)*v;weight+=v});
  return weight?clamp(total/weight):0
}
function reasons(row){
  const out=[];
  if(row.a.startup>=0.75)out.push(`核心启动概率高（${pct(row.a.startup)}）`);
  else if(row.a.startup<0.45)out.push(`核心启动依赖较强（${pct(row.a.startup)}）`);
  if(row.f.avgQuality<=2.8)out.push(`平均 ${num(row.f.avgQuality,1)} 阶，成型成本较低`);
  if(row.f.coreQuality>=4)out.push(`核心平均 ${num(row.f.coreQuality,1)} 阶，上限高但更吃牌库`);
  if(row.f.roleCoverage>=0.99)out.push("前排 / 输出 / 功能位齐全");
  if(row.f.keywordSynergy>=0.45)out.push("机制关键词联动密度较高");
  if(!out.length)out.push("成本、联动与核心依赖较均衡");
  return out.slice(0,3)
}
function heroPill(name,heroMap,assetBase){
  const h=heroMap.get(name);const src=h?.img?`${assetBase||""}${h.img}`:"";
  return `<span class="solver-hero">${src?`<img src="${esc(src)}" alt="" loading="lazy">`:""}<span>${esc(name)}</span><small>${h?`${h.quality}阶`:""}</small></span>`
}
function scoreLabel(v){return Math.round(v*100)}
function settingsFrom(root,defaults){
  return{
    objective:root.querySelector('[name="solver-objective"]:checked')?.value||defaults.objective,
    level:Number(root.querySelector('#solverLevel')?.value||defaults.level),
    refreshes:Number(root.querySelector('#solverRefreshes')?.value||defaults.refreshes),
    contested:Number(root.querySelector('#solverContested')?.value||defaults.contested),
    simulations:Number(defaults.simulations||1200),
    camp:root.querySelector('#solverCamp')?.value||"全部"
  }
}
function renderResults(root,state,model,settings){
  const heroMap=new Map((state.data.heroes||[]).map(h=>[h.name,h]));
  const comps=(state.data.comps||[]).filter(c=>settings.camp==="全部"||(c.camps||[]).includes(settings.camp));
  const rows=comps.map(comp=>{
    const f=compositionFeatures(comp,heroMap);
    const a=simulateAvailability(comp,f,state,model,settings);
    const score=objectiveScore(settings.objective,f,a,model);
    return{comp,f,a,score}
  }).sort((a,b)=>b.score-a.score||b.a.startup-a.a.startup||a.f.avgQuality-b.f.avgQuality);
  const top=rows[0];
  const results=root.querySelector('#solverResults');
  const status=root.querySelector('#solverStatus');
  status.textContent=`已对 ${rows.length} 套阵容进行 ${settings.simulations.toLocaleString('zh-CN')} 次/套的牌库模拟 · 共 ${(rows.length*settings.simulations).toLocaleString('zh-CN')} 个随机对局样本`;
  if(!top){results.innerHTML='<div class="empty-state"><strong>没有匹配阵容</strong><p>调整阵营筛选后重试。</p></div>';return}
  const topReasons=reasons(top);
  results.innerHTML=`
    <section class="solver-winner">
      <div class="solver-winner-main">
        <div class="eyebrow">MODEL PICK · ${esc(model.objectives[settings.objective]?.label||settings.objective)}</div>
        <div class="solver-title-line"><h2>${esc(top.comp.name)}</h2><span class="solver-score">${scoreLabel(top.score)}</span></div>
        <div class="solver-heroes">${(top.comp.core||[]).map(n=>heroPill(n,heroMap,state.manifest?.assetBase)).join("")}</div>
        <p>${topReasons.map(esc).join("；")}。</p>
        <div class="solver-actions"><a class="solver-primary" href="#/comp/${encodeURIComponent(top.comp.id)}">查看阵容详情 →</a><span>模型分不是实战胜率</span></div>
      </div>
      <div class="solver-metrics">
        <div><small>核心启动</small><strong>${pct(top.a.startup)}</strong></div>
        <div><small>主核两张</small><strong>${pct(top.a.twoCopy)}</strong></div>
        <div><small>主核觉醒</small><strong>${pct(top.a.awaken)}</strong></div>
        <div><small>平均品阶</small><strong>${num(top.f.avgQuality,1)}</strong></div>
      </div>
    </section>
    <section class="section solver-ranking">
      <div class="section-title-row"><div><h2>候选排序</h2><p>按当前目标函数和牌库压力重新计算；点击任意阵容查看完整站位、装备和天赋样本。</p></div></div>
      <div class="solver-table">
        <div class="solver-tr solver-th"><span>#</span><span>阵容</span><span>模型分</span><span>启动</span><span>觉醒</span><span>成本</span></div>
        ${rows.slice(0,12).map((row,i)=>`<a class="solver-tr" href="#/comp/${encodeURIComponent(row.comp.id)}"><span>${i+1}</span><span><strong>${esc(row.comp.name)}</strong><small>${esc((row.comp.core||[]).join(' · '))}</small></span><span><strong>${scoreLabel(row.score)}</strong></span><span>${pct(row.a.startup)}</span><span>${pct(row.a.awaken)}</span><span>${num(row.f.avgQuality,1)}阶</span></a>`).join("")}
      </div>
    </section>
  `
}

export async function renderSolver(view,state){
  view.innerHTML=`<div class="empty-state"><strong>正在加载求解模型…</strong><p>读取牌库参数并准备阵容候选。</p></div>`;
  let model;
  try{
    const url=state.manifest?.solverModel||"./data/solver-model.json";
    const r=await fetch(url,{cache:"no-store"});
    if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
    model=await r.json()
  }catch(e){
    view.innerHTML=`<div class="empty-state"><strong>求解模型加载失败</strong><p>${esc(e.message)}</p></div>`;return
  }
  const d=model.defaults;
  const camps=["全部",...(state.data.camps||[]).map(c=>c.name)];
  view.innerHTML=`
    <header class="page-head"><div><div class="eyebrow">LINEUP SOLVER · v${esc(model.gameVersion)}</div><h1>阵容求解器</h1><p>把阵容当成“强度 × 成型概率 × 资源成本 × 容错”的组合优化问题。先在已核验的 ${state.data.comps?.length||0} 套阵容中求解，再逐步扩展到 85 英雄的组合搜索。</p></div></header>
    <section class="solver-panel" id="solverRoot">
      <div class="solver-controls">
        <fieldset class="solver-objectives"><legend>优化目标</legend>${Object.entries(model.objectives).map(([k,o])=>`<label><input type="radio" name="solver-objective" value="${esc(k)}" ${k===d.objective?"checked":""}><span>${esc(o.label)}</span></label>`).join("")}</fieldset>
        <div class="solver-selects">
          <label><span>搜索等级</span><select id="solverLevel">${[3,4,5,6].map(n=>`<option value="${n}" ${n===d.level?"selected":""}>${n}级</option>`).join("")}</select></label>
          <label><span>刷新次数</span><select id="solverRefreshes">${[4,6,8,10,12,16].map(n=>`<option value="${n}" ${n===d.refreshes?"selected":""}>${n} 次 · ${n*5} 格</option>`).join("")}</select></label>
          <label><span>同行压力</span><select id="solverContested">${[[0,"无人卡牌"],[2,"轻度 · 核心少2张"],[4,"重度 · 核心少4张"]].map(([v,l])=>`<option value="${v}" ${v===d.contested?"selected":""}>${l}</option>`).join("")}</select></label>
          <label><span>阵营</span><select id="solverCamp">${camps.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select></label>
        </div>
      </div>
      <div class="solver-note"><strong>模型边界</strong><span>当前模拟的是公共牌库与商店成型随机性，战斗强度使用阵容结构代理分。它不会把“模型分”伪装成真实胜率。</span></div>
      <div class="solver-status" id="solverStatus" aria-live="polite"></div>
      <div id="solverResults"></div>
    </section>
    <section class="section solver-method"><div class="section-title-row"><div><h2>怎么算</h2><p>所有参数公开，方便以后随版本调整。</p></div></div><div class="solver-method-grid"><div><small>公共牌库</small><strong>14 / 11 / 9 / 7 / 6</strong><p>分别对应1—5阶每名英雄库存。</p></div><div><small>商店概率</small><strong>按棋手等级</strong><p>每个商店栏位先抽品阶，再受公共牌库余量影响。</p></div><div><small>稳定性</small><strong>启动 + 两张主核</strong><p>把“见到核心”和“主核继续成长”同时纳入。</p></div><div><small>战力代理</small><strong>品阶 + 角色 + 机制联动</strong><p>只用于候选排序，不等价于真实战斗模拟。</p></div></div></section>
  `;
  const root=view.querySelector('#solverRoot');
  const rerun=()=>{const settings=settingsFrom(root,d);renderResults(root,state,model,settings)};
  root.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',rerun));
  rerun()
}
