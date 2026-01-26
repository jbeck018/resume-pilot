import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Lazy initialization for database connection
// Prevents errors during build when env vars aren't available
let _db: PostgresJsDatabase<typeof schema> | null = null;

const getDatabaseUrl = (): string => {
	const dbUrl = env.SUPABASE_DB_URL;

	if (dbUrl) {
		return dbUrl;
	}

	throw new Error('SUPABASE_DB_URL environment variable is required');
};

// Lazy getter for database connection
export const getDb = (): PostgresJsDatabase<typeof schema> => {
	if (!_db) {
		const client = postgres(getDatabaseUrl(), {
			prepare: false, // Required for Supabase connection pooling
			max: 1 // Limit connections in serverless
		});
		_db = drizzle(client, { schema });
	}
	return _db;
};

// Backward compatible export - lazy initialized
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
	get(_, prop) {
		return getDb()[prop as keyof PostgresJsDatabase<typeof schema>];
	}
});

// Export schema for use elsewhere
export * from './schema';
