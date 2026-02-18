#!/usr/bin/env node
import { execSync } from "node:child_process";

const secrets = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
];

for (const key of secrets) {
  console.log(`\nSetting secret: ${key}`);
  execSync(`cd worker && npx wrangler secret put ${key}`, { stdio: "inherit" });
}

console.log("\nSecrets updated.");
