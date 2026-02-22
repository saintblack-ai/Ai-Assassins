type EmailEnv = {
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
};

export async function sendEmail(
  env: EmailEnv,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.FROM_EMAIL || "").trim();
  const recipient = String(to || "").trim();
  if (!apiKey || !from || !recipient) {
    return { success: false, error: "email_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipient,
      subject,
      html: htmlBody,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { success: false, status: response.status, error: text || "resend_request_failed" };
  }
  return { success: true, status: response.status };
}

