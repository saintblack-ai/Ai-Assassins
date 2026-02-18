.PHONY: supabase:init supabase:migrate worker:deploy pages:deploy

supabase:init:
	bash ./scripts/supabase-init.sh

supabase:migrate:
	bash ./scripts/supabase-migrate.sh

worker:deploy:
	npm run worker:deploy

pages:deploy:
	npm run pages:deploy
