# Data Storage Policy

## Stored Data Classes
1. User profile: id, email, created/updated timestamps
2. Access control: tier, entitlement source payload, update timestamp
3. Usage counters: user/day brief count
4. Brief history: generated JSON + timestamp

## Storage Backends
- Preferred: Cloudflare D1 (`BRIEFS_DB`)
- Fallback: Cloudflare KV (`BRIEFS_KV`)
- Development fallback: in-memory maps (non-durable)

## Encryption and Access
- TLS for transport
- Cloudflare account-level IAM
- Secrets only in Worker bindings

## Deletion and Retention
- User-requested delete supported operationally through data owner workflows
- Audit logs retained per compliance policy
