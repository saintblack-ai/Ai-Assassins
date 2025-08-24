// integrations.js v7 — includes ICS + focus block and renders clean links via index renderer
window.AIA=(()=>{
  const fill=async(b,s)=>{
    await Promise.allSettled([
      weather(b,s),
      markets(b),
      btc(b),
      scripture(b,s),
      news(b,s),
      calendar(b,s),
      focusBlock(b,s)
    ]);
    return b;
  };
  function sec(b,k){return b.sections.find(x=>x.key===k);}

  async function weather(b,s){
    if(!s.latlon) return;
    const [lat,lon]=(s.latlon||'').split(',').map(x=>parseFloat(x.trim()));
    if([lat,lon].some(Number.isNaN)) return;
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=1&timezone=auto`);
    if(!r.ok) return;
    const j=await r.json();
    const S=sec(b,'weather');
    S.items=[`High / Low: ${j.daily?.temperature_2m_max?.[0]??'—'}° / ${j.daily?.temperature_2m_min?.[0]??'—'}°`,`Precip: ${j.daily?.precipitation_sum?.[0]??'—'} mm`];
  }

  async function btc(b){
    try{
      const r=await fetch('https://api.coindesk.com/v1/bpi/currentprice.json');
      if(!r.ok) return;
      const j=await r.json();
      const usd=j?.bpi?.USD?.rate_float;
      if(!usd) return;
      const M=sec(b,'markets');
      for(const row of M.kvs){ if(row[0]==='BTC'){ row[1]='$'+usd.toLocaleString(undefined,{maximumFractionDigits:0}); } }
    }catch{}
  }

  async function markets(b){
    try{
      const sy=encodeURIComponent('^GSPC,^IXIC,CL=F');
      const r=await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${sy}`);
      if(!r.ok) return;
      const j=await r.json();
      const map={}; for(const q of j.quoteResponse.result){ map[q.symbol]=q; }
      const M=sec(b,'markets');
      const rows={'S&P 500':map['^GSPC'],'Nasdaq':map['^IXIC'],'WTI':map['CL=F']};
      M.kvs=Object.entries(rows).map(([n,q])=> q ? [n,`${q.regularMarketPrice?.toFixed(2)} (${(q.regularMarketChangePercent??0).toFixed(2)}%)`] : [n,'—'])
             .concat(M.kvs.find(r=>r[0]==='BTC')?[]:[['BTC','—']]);
    }catch{}
  }

  async function scripture(b,s){
    const verses={
      kjv:[['Psalm 27:1','The LORD is my light and my salvation; whom shall I fear?'],['Isaiah 41:10','Fear thou not; for I am with thee...'],['John 14:27','Peace I leave with you, my peace I give unto you...']],
      niv:[['Psalm 27:1','The LORD is my light and my salvation— whom shall I fear?'],['Isaiah 41:10','So do not fear, for I am with you...'],['John 14:27','Peace I leave with you; my peace I give you...']],
      esv:[['Psalm 27:1','The LORD is my light and my salvation; whom shall I fear?'],['Isaiah 41:10','Fear not, for I am with you...'],['John 14:27','Peace I leave with you; my peace I give to you...']]
    };
    const pref=(s.scripturePref||'kjv').toLowerCase();
    const arr=verses[pref]||verses.kjv;
    const [ref,text]=arr[(new Date()).getDate()%arr.length];
    const S=sec(b,'scripture');
    S.items=[pref.toUpperCase()+' — '+ref,text,'Reflection: Courage under pressure; Christ steadies the mission.'];
  }

  async function news(b,s){
    const S=sec(b,'overview'); if(!S) return;
    try{
      if(s.newsApiKey){
        const q=encodeURIComponent('geopolitics OR defense OR cyber OR space OR infrastructure');
        const r=await fetch(`https://newsapi.org/v2/top-headlines?language=en&pageSize=6&q=${q}`, {headers:{'X-Api-Key':s.newsApiKey}});
        if(r.ok){
          const j=await r.json();
          S.items=(j.articles||[]).slice(0,6).map(a=>`<a class="a" href="${a.url}" target="_blank" rel="noopener">${a.title}</a>`);
          return;
        }
      }
      const feeds=['https://feeds.bbci.co.uk/news/world/rss.xml','https://www.defense.gov/Newsroom/News/RSS/','https://www.nasa.gov/news-release/feed/'];
      const rs=await Promise.allSettled(feeds.map(f=>fetch('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(f))));
      const items=[];
      for(const r of rs){
        if(r.status==='fulfilled' && r.value.ok){
          const j=await r.value.json();
          for(const it of (j.items||[]).slice(0,2)){
            items.push(`<a class="a" href="${it.link}" target="_blank" rel="noopener">${it.title}</a>`);
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
      const r=await fetch(url);
      if(!r.ok){ S.items=[`(Could not fetch ICS: ${r.status})`]; return; }
      const text=await r.text();
      const events=parseICS(text);
      const now=new Date();
      const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0);
      const todayEnd=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59);
      const tomorrowStart=new Date(todayStart.getTime()+86400000);
      const tomorrowEnd=new Date(todayEnd.getTime()+86400000);

      const upcoming=events.filter(e=> e.start && e.start>now).sort((a,b)=>a.start-b.start).slice(0, s.agendaCount||3);
      const tomorrow=events.filter(e=> e.start>=tomorrowStart && e.start<=tomorrowEnd).sort((a,b)=>a.start-b.start).slice(0,2);

      const lines=[];
      if(upcoming.length){ lines.push(...upcoming.map(e=>fmtEvent(e))); } else { lines.push('(No upcoming events found)'); }
      if(tomorrow.length){ lines.push('<em>D+1 Preview</em>'); lines.push(...tomorrow.map(e=>fmtEvent(e))); }
      S.items=lines;
    }catch(e){ S.items=['(Calendar blocked by CORS or invalid ICS URL)']; }
  }

  async function focusBlock(b,s){
    const url=s.icsUrl?.trim(); if(!url) return;
    const S=sec(b,'focus'); if(!S) return;
    try{
      const r=await fetch(url); if(!r.ok) return;
      const text=await r.text();
      const events=parseICS(text).filter(e=>e.start && e.end);
      const now=new Date();
      const dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate(),8,0,0);
      const dayEnd=new Date(now.getFullYear(),now.getMonth(),now.getDate(),20,0,0);
      let t=Math.max(now.getTime(), dayStart.getTime());
      events.sort((a,b)=>a.start-b.start);
      for(const e of events){
        const sT=e.start.getTime(), eT=e.end.getTime();
        if(eT<=t) continue;
        if(sT - t >= 2*60*60*1000 && t+2*60*60*1000 <= dayEnd.getTime()){
          const start=new Date(t); const end=new Date(t+2*60*60*1000);
          S.items=[`🧭 Suggested Focus Block: ${fmtHM(start)}–${fmtHM(end)}`]; return;
        }
        t=Math.max(t, eT);
      }
      if(dayEnd.getTime() - t >= 2*60*60*1000){
        const start=new Date(t); const end=new Date(t+2*60*60*1000);
        S.items=[`🧭 Suggested Focus Block: ${fmtHM(start)}–${fmtHM(end)}`]; return;
      }
      S.items=['🧭 Suggested Focus Block: (No 2‑hour window left today)'];
    }catch{}
  }

  function fmtHM(d){ return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(d); }
  function fmtEvent(e){
    const date = new Intl.DateTimeFormat(undefined,{month:'short', day:'2-digit', weekday:'short'}).format(e.start);
    const time = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(e.start) + (e.end?'–'+new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(e.end):'');
    return `${date} ${time} — ${e.summary||'(No title)'}${e.location?' @ '+e.location:''}`;
  }

  function parseICS(text){
    const lines=text.replace(/\r/g,'').split('\n');
    const out=[]; let cur=null;
    const unfolded=[]; for(const ln of lines){ if(/^[ \t]/.test(ln)){ unfolded[unfolded.length-1]+=ln.slice(1); } else { unfolded.push(ln); } }
    for(const ln of unfolded){
      if(ln.startsWith('BEGIN:VEVENT')) cur={};
      else if(ln.startsWith('END:VEVENT')) { if(cur) out.push(cur); cur=null; }
      else if(cur){
        if(ln.startsWith('SUMMARY:')) cur.summary=ln.slice(8).trim();
        else if(ln.startsWith('LOCATION:')) cur.location=ln.slice(9).trim();
        else if(ln.startsWith('DTSTART')) cur.start=parseICSTime(ln);
        else if(ln.startsWith('DTEND')) cur.end=parseICSTime(ln);
      }
    }
    return out;
  }
  function parseICSTime(ln){
    const m=ln.match(/:(\d{8}T\d{6}Z?)/); if(!m) return null;
    const raw=m[1];
    if(raw.endsWith('Z')) return new Date(raw);
    const y=parseInt(raw.slice(0,4),10), mo=parseInt(raw.slice(4,6),10), d=parseInt(raw.slice(6,8),10);
    const hh=parseInt(raw.slice(9,11),10), mm=parseInt(raw.slice(11,13),10), ss=parseInt(raw.slice(13,15),10);
    return new Date(y, mo-1, d, hh, mm, ss);
  }

  return { fillLive: fill };
})();