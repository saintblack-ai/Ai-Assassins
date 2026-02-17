export type Brief = {
  ts: string;
  title: string;
  timezone: string;
  sections: {
    overnight_overview: string[];
    markets: string[];
    cyber: string[];
    geo: string[];
  };
  raw?: string;
};

function nowInTZ(timeZone: string) {
  const d = new Date();
  // Create a formatter that returns parts in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const HH = get("hour");
  const MM = get("minute");
  return {
    yyyy,
    mm,
    dd,
    HH,
    MM,
    ymd: `${yyyy}-${mm}-${dd}`,
    hhmm: `${HH}${MM}`,
  };
}

export async function generateBrief(
  env: any,
  opts?: { timezone?: string }
): Promise<Brief> {
  const timezone = opts?.timezone || env.BRIEF_TIMEZONE || "America/Chicago";
  const t = nowInTZ(timezone);

  // If you already have a “brief generator” function in your worker, call it here instead.
  // This is a safe placeholder template that can be replaced with your existing OpenAI flow.
  const title = `ARCHAIOS Daily Brief — ${t.ymd}`;

  const brief: Brief = {
    ts: new Date().toISOString(),
    title,
    timezone,
    sections: {
      overnight_overview: [
        "Priority watch: geopolitical + cyber activity signals; monitor escalation pathways.",
        "Action: verify infrastructure health + revenue events, then produce 3 content outputs (shorts, post, script).",
        "Mission: protect focus, ship one improvement, publish one asset, outreach to one lead.",
      ],
      markets: [
        "Track: S&P / BTC / ETH / rates / energy as risk indicators.",
        "If volatility rises: publish a ‘calm intelligence’ brief + position content for your audience.",
      ],
      cyber: [
        "Scan: major CVEs, platform outages, credential-stuffing indicators.",
        "Action: rotate keys quarterly; confirm rate-limit + auth enforcement are on.",
      ],
      geo: [
        "Monitor: Indo-Pacific, EU/RU, Middle East developments; watch maritime + satellite domain signals.",
        "Action: keep messaging neutral and fact-based; avoid rumor amplification.",
      ],
    },
    raw: "template",
  };

  return brief;
}

export function shouldSendNow(env: any) {
  const timezone = env.BRIEF_TIMEZONE || "America/Chicago";
  const sendHHMM = (env.BRIEF_SEND_HHMM || "0700").replace(":", "");
  const t = nowInTZ(timezone);
  return {
    timezone,
    sendHHMM,
    nowHHMM: t.hhmm,
    ymd: t.ymd,
    match: t.hhmm === sendHHMM,
  };
}

export function makeBriefKey(timezone: string, ymd: string, hhmm: string) {
  return `brief:${timezone}:${ymd}:${hhmm}`;
}
