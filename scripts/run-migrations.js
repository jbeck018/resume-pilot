#!/usr/bin/env node
/**
 * Database Migration Runner for Cloudflare Pages
 * Runs all SQL migrations in order during the build process
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import pg from 'pg';

const { Client } = pg;

const MIGRATIONS_DIR = './supabase/migrations';

async function runMigrations() {
	const dbUrl = process.env.SUPABASE_DB_URL;

	if (!dbUrl) {
		console.log('⚠️  SUPABASE_DB_URL not set, skipping migrations');
		process.exit(0);
	}

	console.log('🔄 Starting database migrations...');

	const client = new Client({ connectionString: dbUrl });

	try {
		await client.connect();
		console.log('✅ Connected to database');

		// Create migrations tracking table if it doesn't exist
		await client.query(`
			CREATE TABLE IF NOT EXISTS _migrations (
				id SERIAL PRIMARY KEY,
				name VARCHAR(255) NOT NULL UNIQUE,
				executed_at TIMESTAMPTZ DEFAULT NOW()
			)
		`);

		// Get list of already executed migrations
		const { rows: executed } = await client.query(
			'SELECT name FROM _migrations ORDER BY name'
		);
		const executedNames = new Set(executed.map(r => r.name));

		// Get all migration files
		const files = await readdir(MIGRATIONS_DIR);
		const sqlFiles = files
			.filter(f => f.endsWith('.sql'))
			.sort();

		let migrationsRun = 0;

		for (const file of sqlFiles) {
			if (executedNames.has(file)) {
				console.log(`⏭️  Skipping ${file} (already executed)`);
				continue;
			}

			console.log(`📄 Running ${file}...`);

			const filePath = join(MIGRATIONS_DIR, file);
			const sql = await readFile(filePath, 'utf-8');

			try {
				await client.query('BEGIN');
				await client.query(sql);
				await client.query(
					'INSERT INTO _migrations (name) VALUES ($1)',
					[file]
				);
				await client.query('COMMIT');
				console.log(`✅ ${file} completed`);
				migrationsRun++;
			} catch (err) {
				await client.query('ROLLBACK');
				console.error(`❌ ${file} failed:`, err.message);
				// Continue with other migrations instead of failing the build
				console.log('⚠️  Continuing with remaining migrations...');
			}
		}

		console.log(`\n🎉 Migrations complete! ${migrationsRun} new migrations executed.`);

	} catch (err) {
		console.error('❌ Migration error:', err.message);
		// Don't fail the build for migration errors
		process.exit(0);
	} finally {
		await client.end();
	}
}

runMigrations();
