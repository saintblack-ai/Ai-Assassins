export type IdentityResolveInput = {
  authUserId?: string | null;
  deviceHeader?: string | null;
  bodyDeviceId?: string | null;
};

export function resolveBriefUserId(input: IdentityResolveInput): string | null {
  const authUserId = String(input.authUserId || "").trim();
  if (authUserId) return authUserId;
  const deviceHeader = String(input.deviceHeader || "").trim();
  if (deviceHeader) return `device:${deviceHeader}`;
  const bodyDeviceId = String(input.bodyDeviceId || "").trim();
  if (bodyDeviceId) return `device:${bodyDeviceId}`;
  return null;
}

