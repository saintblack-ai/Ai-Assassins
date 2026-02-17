import type { Brief } from "./briefTemplate";

export async function sendBriefEmail(env: any, brief: Brief) {
  if (!env.RESEND_API_KEY || !env.BRIEF_EMAIL_TO || !env.FROM_EMAIL) {
    console.log("Email skipped (missing RESEND_API_KEY or BRIEF_EMAIL_TO or FROM_EMAIL).");
    return { skipped: true };
  }

  const html = `
    <h2>${brief.title}</h2>
    <p><strong>Timestamp:</strong> ${brief.ts} (${brief.timezone})</p>
    <h3>Overnight Overview</h3>
    <ul>${brief.sections.overnight_overview.map((x) => `<li>${x}</li>`).join("")}</ul>
    <h3>Markets</h3>
    <ul>${brief.sections.markets.map((x) => `<li>${x}</li>`).join("")}</ul>
    <h3>Cyber</h3>
    <ul>${brief.sections.cyber.map((x) => `<li>${x}</li>`).join("")}</ul>
    <h3>Geopolitical</h3>
    <ul>${brief.sections.geo.map((x) => `<li>${x}</li>`).join("")}</ul>
  `;

  const payload = {
    from: env.FROM_EMAIL,
    to: env.BRIEF_EMAIL_TO,
    subject: brief.title,
    html,
  };

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`Resend error ${resp.status}: ${text}`);
  return { ok: true, result: text };
}
