#!/usr/bin/env npx tsx
/**
 * SQL Migration Runner for Supabase
 *
 * Executes SQL against the Supabase database using SUPABASE_DB_URL.
 *
 * Usage:
 *   npx tsx scripts/run-migration.ts "SELECT * FROM profiles LIMIT 1"
 *   npx tsx scripts/run-migration.ts --file ./supabase/migrations/0001_initial_schema.sql
 *   echo "SELECT 1" | npx tsx scripts/run-migration.ts
 *   cat migration.sql | npx tsx scripts/run-migration.ts
 *
 * Options:
 *   --file, -f    Read SQL from a file
 *   --dry-run     Print SQL without executing
 *   --verbose     Show detailed output
 *   --help, -h    Show help
 */

import postgres from 'postgres';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ANSI colors for terminal output
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	dim: '\x1b[2m'
};

function log(message: string, color?: keyof typeof colors): void {
	const colorCode = color ? colors[color] : '';
	console.log(`${colorCode}${message}${colors.reset}`);
}

function logError(message: string): void {
	console.error(`${colors.red}Error: ${message}${colors.reset}`);
}

function printHelp(): void {
	console.log(`
SQL Migration Runner for Supabase

Usage:
  npx tsx scripts/run-migration.ts "SQL STATEMENT"
  npx tsx scripts/run-migration.ts --file ./path/to/migration.sql
  echo "SELECT 1" | npx tsx scripts/run-migration.ts

Options:
  --file, -f <path>   Read SQL from a file
  --dry-run           Print SQL without executing
  --verbose, -v       Show detailed output
  --help, -h          Show this help message

Environment:
  SUPABASE_DB_URL     PostgreSQL connection string (required)

Examples:
  # Run inline SQL
  npx tsx scripts/run-migration.ts "ALTER TABLE profiles ADD COLUMN test TEXT"

  # Run from file
  npx tsx scripts/run-migration.ts -f ./supabase/migrations/0009_add_learned_preferences.sql

  # Dry run (preview only)
  npx tsx scripts/run-migration.ts --dry-run "DROP TABLE test"

  # From stdin
  cat my-migration.sql | npx tsx scripts/run-migration.ts
`);
}

interface Options {
	sql: string | null;
	file: string | null;
	dryRun: boolean;
	verbose: boolean;
	help: boolean;
}

function parseArgs(args: string[]): Options {
	const options: Options = {
		sql: null,
		file: null,
		dryRun: false,
		verbose: false,
		help: false
	};

	let i = 0;
	while (i < args.length) {
		const arg = args[i];

		if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else if (arg === '--dry-run') {
			options.dryRun = true;
		} else if (arg === '--verbose' || arg === '-v') {
			options.verbose = true;
		} else if (arg === '--file' || arg === '-f') {
			i++;
			options.file = args[i];
		} else if (!arg.startsWith('-')) {
			// Treat non-flag arguments as SQL
			options.sql = arg;
		}

		i++;
	}

	return options;
}

async function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		// Check if stdin is a TTY (interactive terminal)
		if (process.stdin.isTTY) {
			resolve('');
			return;
		}

		let data = '';
		process.stdin.setEncoding('utf8');

		process.stdin.on('readable', () => {
			let chunk;
			while ((chunk = process.stdin.read()) !== null) {
				data += chunk;
			}
		});

		process.stdin.on('end', () => {
			resolve(data.trim());
		});

		process.stdin.on('error', reject);

		// Set a timeout to avoid hanging if no stdin is provided
		setTimeout(() => {
			resolve(data.trim());
		}, 100);
	});
}

async function executeSql(sql: string, options: Options): Promise<void> {
	// Dry run doesn't need a database connection
	if (options.dryRun) {
		log('\n=== DRY RUN - SQL will NOT be executed ===\n', 'yellow');
		log(sql, 'dim');
		log('\n=== End of SQL ===\n', 'yellow');
		return;
	}

	const dbUrl = process.env.SUPABASE_DB_URL;

	if (!dbUrl) {
		logError('SUPABASE_DB_URL environment variable is required');
		logError('Set it in your .env file or export it in your shell');
		process.exit(1);
	}

	if (options.verbose) {
		log('Connecting to database...', 'dim');
	}

	const client = postgres(dbUrl, {
		prepare: false, // Required for Supabase connection pooling
		max: 1,
		onnotice: options.verbose ? (notice) => log(`Notice: ${notice.message}`, 'dim') : undefined
	});

	try {

		if (options.verbose) {
			log('\n=== Executing SQL ===\n', 'blue');
			log(sql, 'dim');
			log('\n=== End of SQL ===\n', 'blue');
		}

		const startTime = Date.now();

		// Use unsafe for raw SQL execution (migrations often contain multiple statements)
		const result = await client.unsafe(sql);

		const duration = Date.now() - startTime;

		log(`\nSuccess! Query executed in ${duration}ms`, 'green');

		// Show result summary
		if (Array.isArray(result) && result.length > 0) {
			if (options.verbose || result.length <= 10) {
				log('\nResult:', 'blue');
				console.table(result);
			} else {
				log(`\nReturned ${result.length} rows (use --verbose to see all)`, 'dim');
				console.table(result.slice(0, 5));
				log(`... and ${result.length - 5} more rows`, 'dim');
			}
		}
	} catch (error) {
		const pgError = error as { message?: string; code?: string; position?: string; detail?: string };

		logError('SQL execution failed');
		console.error('\nError details:');

		if (pgError.code) {
			console.error(`  Code: ${pgError.code}`);
		}
		if (pgError.message) {
			console.error(`  Message: ${pgError.message}`);
		}
		if (pgError.position) {
			console.error(`  Position: ${pgError.position}`);
		}
		if (pgError.detail) {
			console.error(`  Detail: ${pgError.detail}`);
		}

		process.exit(1);
	} finally {
		await client.end();

		if (options.verbose) {
			log('Connection closed', 'dim');
		}
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const options = parseArgs(args);

	if (options.help) {
		printHelp();
		process.exit(0);
	}

	let sql: string | null = null;

	// Priority: 1. --file, 2. argument, 3. stdin
	if (options.file) {
		const filePath = resolve(process.cwd(), options.file);

		if (!existsSync(filePath)) {
			logError(`File not found: ${filePath}`);
			process.exit(1);
		}

		sql = readFileSync(filePath, 'utf8');

		if (options.verbose) {
			log(`Reading SQL from file: ${filePath}`, 'dim');
		}
	} else if (options.sql) {
		sql = options.sql;
	} else {
		// Try to read from stdin
		sql = await readStdin();
	}

	if (!sql || sql.trim() === '') {
		logError('No SQL provided');
		log('\nProvide SQL via:', 'yellow');
		log('  - Command argument: npx tsx scripts/run-migration.ts "SELECT 1"', 'dim');
		log('  - File: npx tsx scripts/run-migration.ts --file migration.sql', 'dim');
		log('  - Stdin: echo "SELECT 1" | npx tsx scripts/run-migration.ts', 'dim');
		log('\nUse --help for more information', 'dim');
		process.exit(1);
	}

	await executeSql(sql, options);
}

main().catch((error) => {
	logError(error.message || 'Unknown error');
	process.exit(1);
});
