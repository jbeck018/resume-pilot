import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/database/schema.ts',
	out: './supabase/migrations',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.SUPABASE_DB_URL!
	}
});
