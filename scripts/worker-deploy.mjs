#!/usr/bin/env node
import { execSync } from "node:child_process";

execSync("cd worker && npx wrangler deploy", { stdio: "inherit" });
