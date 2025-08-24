// Live data hooks: weather, markets, BTC, news, scripture, and calendar ICS
window.AIA=(()=>{
  const fill=async(b,s)=>{
    await Promise.allSettled([
      weather(b,s),
      markets(b),
      btc(b),
      scripture(b,s),
      news(b,s),
      calendar(b,s)
    ]);
    return b;
  };
  function sec(b,k){return b.sections.find(x=>x.key===k);}

  // Weather via Open-Meteo
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

  // BTC via Coindesk
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

  // S&P, Nasdaq, WTI via Yahoo Finance (best-effort CORS)
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

  // Scripture rotation
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

  // Headlines via NewsAPI key or RSS fallback
  async function news(b,s){
    const S=sec(b,'overview'); if(!S) return;
    try{
      if(s.newsApiKey){
        const q=encodeURIComponent('geopolitics OR defense OR cyber OR space OR infrastructure');
        const r=await fetch(`https://newsapi.org/v2/top-headlines?language=en&pageSize=6&q=${q}`, {headers:{'X-Api-Key':s.newsApiKey}});
        if(r.ok){
          const j=await r.json();
          S.items=(j.articles||[]).slice(0,6).map(a=>`<a href="${a.url}" target="_blank" rel="noopener">${a.title}</a>`);
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
            items.push(`<a href="${it.link}" target="_blank" rel="noopener">${it.title}</a>`);
          }
        }
      }
      S.items = items.length?items:['(Add a NewsAPI key in Settings for richer headlines)'];
    }catch{}
  }

  // Calendar ICS parsing (best-effort; may require CORS-friendly ICS)
  async function calendar(b,s){
    const url = s.icsUrl?.trim();
    if(!url) return;
    const S = sec(b,'calendar');
    try{
      const r = await fetch(url);
      if(!r.ok){ S.items=[`(Could not fetch ICS: ${r.status})`]; return; }
      const text = await r.text();
      const events = parseICS(text);
      const now = new Date();
      const upcoming = events.filter(e=> e.start && e.start > now).sort((a,b)=> a.start - b.start).slice(0, s.agendaCount||3);
      if(!upcoming.length){ S.items=['(No upcoming events found)']; return; }
      S.items = upcoming.map(e => fmtEvent(e));
      const todayEvents = events.filter(e=> sameDay(e.start, now));
      // D+1 preview (tomorrow)
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
      const tomorrowEvents = events.filter(e=> sameDay(e.start, tomorrow)).sort((a,b)=> a.start-b.start).slice(0, s.agendaCount||3);
      if (tomorrowEvents.length){
        S.items.push('<em>D+1 preview:</em>');
        S.items = S.items.concat(tomorrowEvents.map(e=> fmtEvent(e)));
      }
      // Suggest a focus block: next free 2-hour window today between 08:00 and 19:00
      suggestFocus(todayEvents, b);

    }catch(e){
      S.items=[`(Calendar blocked by CORS or invalid ICS URL)`];
    }
  }

  function fmtEvent(e){
    const dtFmt = new Intl.DateTimeFormat(undefined,{weekday:'short', hour:'2-digit', minute:'2-digit'});
    const day = new Intl.DateTimeFormat(undefined,{month:'short', day:'2-digit'}).format(e.start);
    const time = dtFmt.format(e.start) + (e.end ? '–' + new Intl.DateTimeFormat(undefined,{hour:'2-digit', minute:'2-digit'}).format(e.end) : '');
    return `${day} ${time} — ${e.summary || '(No title)'}${e.location? ' @ '+e.location : ''}`;
  }

  // Minimal ICS parser
  function parseICS(text){
    const lines = text.replace(/\r/g,'').split('\n');
    const events=[]; let cur=null;
    const unfold=[];
    for(let i=0;i<lines.length;i++){
      const line = lines[i];
      if(line.startsWith(' ') || line.startsWith('\t')){
        // continuation line
        unfold[unfold.length-1] += line.slice(1);
      }else{
        unfold.push(line);
      }
    }
    for(const ln of unfold){
      if(ln.startsWith('BEGIN:VEVENT')){ cur={}; }
      else if(ln.startsWith('END:VEVENT')){ if(cur) events.push(cur); cur=null; }
      else if(cur){
        if(ln.startsWith('SUMMARY:')) cur.summary = ln.slice(8).trim();
        else if(ln.startsWith('LOCATION:')) cur.location = ln.slice(9).trim();
        else if(ln.startsWith('DTSTART')) cur.start = parseICSTime(ln);
        else if(ln.startsWith('DTEND')) cur.end = parseICSTime(ln);
      }
    }
    return events;
  }
  function parseICSTime(ln){
    const m = ln.match(/:(\d{8}T\d{6}Z?)/);
    if(!m) return null;
    const raw = m[1];
    if(raw.endsWith('Z')) return new Date(raw);
    // treat as local if no Z
    const y=raw.slice(0,4), mo=raw.slice(4,6), d=raw.slice(6,8), hh=raw.slice(9,11), mm=raw.slice(11,13), ss=raw.slice(13,15);
    return new Date(+y, +mo-1, +d, +hh, +mm, +ss);
  }

  return { fillLive: fill };
})();
  function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function suggestFocus(todayEvents, brief){
    const S = sec(brief,'focusblock'); if(!S) return;
    // Define working window 08:00-19:00 today
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.max(8, now.getHours()), now.getMinutes(), 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0);
    // Build busy slots
    const busy = todayEvents.map(e=>({s:e.start, e:e.end || new Date(e.start.getTime()+60*60*1000)})).filter(x=> x.e>start && x.s<end).sort((a,b)=>a.s-b.s);
    // Scan for next free >= 120min
    let cursor = new Date(start);
    for(const b of busy){
      if(b.s > cursor){
        const gap = (b.s - cursor)/60000;
        if(gap >= 120){ // two hours
          const fin = new Date(cursor.getTime()+120*60000);
          S.items = [ `${fmtTime(cursor)}–${fmtTime(fin)} — Deep work on QX AI chip or Nanotech dossier` ]; return;
        }
      }
      if(b.e > cursor) cursor = new Date(b.e);
    }
    if(end > cursor && (end - cursor)/60000 >= 120){
      const fin = new Date(cursor.getTime()+120*60000);
      S.items = [ `${fmtTime(cursor)}–${fmtTime(fin)} — Deep work on QX AI chip or Nanotech dossier` ]; return;
    }
    // fallback evening block
    const fbS = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0);
    const fbE = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
    S.items = [ `${fmtTime(fbS)}–${fmtTime(fbE)} — Strategy review & sermon prep` ];
  }
  function fmtTime(d){ return new Intl.DateTimeFormat(undefined,{hour:'2-digit', minute:'2-digit'}).format(d); }
