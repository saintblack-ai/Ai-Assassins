// v9 integrations — live hooks (best-effort CORS)
window.AIA=(()=>{
  const DEFAULT_MARKETS_WORKER_URL='https://archaios-proxy.quandrix357.workers.dev';
  const fill=async(b,s)=>{await Promise.allSettled([weather(b,s),marketsFromWorker(b,s),scripture(b,s),news(b,s),calendar(b,s)]);return b;};
  function sec(b,k){return b.sections.find(x=>x.key===k);}

  async function weather(b,s){
    if(!s.latlon) return;
    const [lat,lon]=(s.latlon||'').split(',').map(x=>parseFloat(x.trim()));
    if([lat,lon].some(Number.isNaN)) return;
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=1&timezone=auto`);
    if(!r.ok) return;
    const j=await r.json();
    sec(b,'weather').items=[`High / Low: ${j.daily?.temperature_2m_max?.[0]??'—'}° / ${j.daily?.temperature_2m_min?.[0]??'—'}°`,`Precip: ${j.daily?.precipitation_sum?.[0]??'—'} mm`];
  }

  async function marketsFromWorker(b,s){
    try{
      const workerUrl=(s?.marketsWorkerUrl||s?.workerUrl||window.AIA_MARKETS_WORKER_URL||DEFAULT_MARKETS_WORKER_URL).trim();
      if(!workerUrl) return;
      const r=await fetch(workerUrl);
      if(!r.ok) return;
      const j=await r.json();
      const m=(j&&typeof j==='object')?(j.markets||j):{};
      const values={SP500:m.SP500??null,NASDAQ:m.NASDAQ??null,BTC:m.BTC??null};
      updateMarketsSection(b,values);
      updateMarketDom(values);
    }catch{}
  }

  function formatMoney(v){
    return Number.isFinite(v) ? '$'+Number(v).toLocaleString(undefined,{maximumFractionDigits:2}) : '—';
  }

  function updateMarketsSection(b,values){
    const M=sec(b,'markets'); if(!M || !Array.isArray(M.kvs)) return;
    const next=M.kvs.map(([name,val])=>{
      if(name==='S&P 500' || name==='SP500') return ['S&P 500',formatMoney(values.SP500)];
      if(name==='Nasdaq' || name==='NASDAQ') return ['Nasdaq',formatMoney(values.NASDAQ)];
      if(name==='BTC') return ['BTC',formatMoney(values.BTC)];
      return [name,val];
    });
    if(!next.find(r=>r[0]==='S&P 500')) next.push(['S&P 500',formatMoney(values.SP500)]);
    if(!next.find(r=>r[0]==='Nasdaq')) next.push(['Nasdaq',formatMoney(values.NASDAQ)]);
    if(!next.find(r=>r[0]==='BTC')) next.push(['BTC',formatMoney(values.BTC)]);
    M.kvs=next;
  }

  function updateMarketDom(values){
    const ids={SP500:values.SP500,NASDAQ:values.NASDAQ,BTC:values.BTC};
    for(const [id,val] of Object.entries(ids)){
      const el=document.getElementById(id);
      if(el) el.textContent=formatMoney(val);
    }
  }

  async function scripture(b,s){
    const verses={kjv:[['Psalm 27:1','The LORD is my light and my salvation; whom shall I fear?'],['Isaiah 41:10','Fear thou not; for I am with thee...'],['John 14:27','Peace I leave with you, my peace I give unto you...']],
                  niv:[['Psalm 27:1','The LORD is my light and my salvation— whom shall I fear?'],['Isaiah 41:10','So do not fear, for I am with you...'],['John 14:27','Peace I leave with you; my peace I give you...']],
                  esv:[['Psalm 27:1','The LORD is my light and my salvation; whom shall I fear?'],['Isaiah 41:10','Fear not, for I am with you...'],['John 14:27','Peace I leave with you; my peace I give to you...']]};
    const pref=(s.scripturePref||'kjv').toLowerCase(); const arr=verses[pref]||verses.kjv; const [ref,text]=arr[(new Date()).getDate()%arr.length];
    sec(b,'scripture').items=[pref.toUpperCase()+' — '+ref,text,'Reflection: Courage under pressure; Christ steadies the mission.'];
  }

  async function news(b,s){
    const S=sec(b,'overview'); if(!S) return;
    try{
      if(s.newsApiKey){
        const q=encodeURIComponent('geopolitics OR defense OR cyber OR space OR infrastructure');
        const r=await fetch(`https://newsapi.org/v2/top-headlines?language=en&pageSize=6&q=${q}`, {headers:{'X-Api-Key':s.newsApiKey}});
        if(r.ok){ const j=await r.json(); S.items=(j.articles||[]).slice(0,6).map(a=>`<a href="${a.url}" target="_blank" rel="noopener">${a.title}</a>`); return; }
      }
      const feeds=['https://feeds.bbci.co.uk/news/world/rss.xml','https://www.defense.gov/Newsroom/News/RSS/','https://www.nasa.gov/news-release/feed/'];
      const rs=await Promise.allSettled(feeds.map(f=>fetch('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(f))));
      const items=[];
      for(const r of rs){
        if(r.status==='fulfilled' && r.value.ok){
          const j=await r.value.json();
          for(const it of (j.items||[]).slice(0,2)){
            items.push(`<a href="${it.link}" target="_blank" rel="noopener">${it.title}</a>`);
          }
        }
      }
      S.items = items.length?items:['(Add a NewsAPI key in Settings for richer headlines)'];
    }catch{}
  }

  async function calendar(b,s){
    const url=s.icsUrl?.trim(); if(!url) return;
    const S=sec(b,'calendar');
    try{
      const r=await fetch(url); if(!r.ok){ S.items=[`(Could not fetch ICS: ${r.status})`]; return; }
      const text=await r.text(); const events=parseICS(text); const now=new Date();
      const upcoming=events.filter(e=>e.start && e.start>now).sort((a,b)=>a.start-b.start).slice(0,s.agendaCount||3);
      S.items = upcoming.length?upcoming.map(e=>fmtEvent(e)):['(No upcoming events found)'];
    }catch{ S.items=['(Calendar blocked by CORS or invalid ICS URL)']; }
  }

  function fmtEvent(e){
    const dt=new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'2-digit',minute:'2-digit'});
    const day=new Intl.DateTimeFormat(undefined,{month:'short',day:'2-digit'}).format(e.start);
    const time=dt.format(e.start)+(e.end?'–'+new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(e.end):'');
    return `${day} ${time} — ${e.summary||'(No title)'}${e.location?' @ '+e.location:''}`;
  }

  function parseICS(text){
    const lines=text.replace(/\r/g,'').split('\n'); const events=[]; let cur=null;
    const unfolded=[]; for(let i=0;i<lines.length;i++){ const line=lines[i]; if(line.startsWith(' ')||line.startsWith('\t')){ unfolded[unfolded.length-1]+=line.slice(1);} else { unfolded.push(line);} }
    for(const ln of unfolded){
      if(ln.startsWith('BEGIN:VEVENT')){ cur={}; }
      else if(ln.startsWith('END:VEVENT')){ if(cur) events.push(cur); cur=null; }
      else if(cur){
        if(ln.startsWith('SUMMARY:')) cur.summary=ln.slice(8).trim();
        else if(ln.startsWith('LOCATION:')) cur.location=ln.slice(9).trim();
        else if(ln.startsWith('DTSTART')) cur.start=parseICSTime(ln);
        else if(ln.startsWith('DTEND')) cur.end=parseICSTime(ln);
      }
    }
    return events;
  }
  function parseICSTime(ln){
    const m=ln.match(/:(\d{8}T\d{6}Z?)/); if(!m) return null; const raw=m[1];
    if(raw.endsWith('Z')) return new Date(raw);
    const y=raw.slice(0,4), mo=raw.slice(4,6), d=raw.slice(6,8), hh=raw.slice(9,11), mm=raw.slice(11,13), ss=raw.slice(13,15);
    return new Date(+y, +mo-1, +d, +hh, +mm, +ss);
  }
  return { fillLive: fill };
})();
