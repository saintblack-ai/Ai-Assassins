#!/usr/bin/env bash
set -euo pipefail

echo "Install Supabase CLI (if missing): brew install supabase/tap/supabase"
echo "Logging into Supabase..."
supabase login
echo "Link this repository to your Supabase project:"
echo "Run: supabase link --project-ref <your-project-ref>"
