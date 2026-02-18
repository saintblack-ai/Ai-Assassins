#!/usr/bin/env node
import { execSync } from "node:child_process";

execSync("git add docs worker supabase README.md", { stdio: "inherit" });
execSync("git commit -m \"chore: phase a supabase activation deploy\" || true", { stdio: "inherit" });
execSync("git push origin main", { stdio: "inherit" });
