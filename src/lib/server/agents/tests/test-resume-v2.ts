/**
 * Test script for ResumeGenerationAgentV2
 *
 * This script tests the Resume Generation Agent V2 by triggering the Inngest function.
 * It fetches a real job ID from the database and sends an event to Inngest.
 *
 * Usage: npx tsx src/lib/server/agents/tests/test-resume-v2.ts
 *
 * Prerequisites:
 * - INNGEST_EVENT_KEY environment variable set
 * - Database connection configured
 */

import { config } from 'dotenv';
config(); // Load .env file

import postgres from 'postgres';
import { Inngest } from 'inngest';

// =============================================================================
// Configuration
// =============================================================================

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const DATABASE_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!INNGEST_EVENT_KEY) {
	console.error('❌ INNGEST_EVENT_KEY not set');
	process.exit(1);
}

if (!DATABASE_URL) {
	console.error('❌ SUPABASE_DB_URL or DATABASE_URL not set');
	process.exit(1);
}

// =============================================================================
// Database Connection
// =============================================================================

const sql = postgres(DATABASE_URL, {
	max: 1,
	idle_timeout: 10
});

// =============================================================================
// Inngest Client
// =============================================================================

const inngest = new Inngest({
	id: 'howlerhire-test',
	eventKey: INNGEST_EVENT_KEY
});

// =============================================================================
// Test Functions
// =============================================================================

interface JobData {
	id: string;
	title: string;
	company: string;
	user_id: string;
}

interface ProfileData {
	id: string;
	full_name: string;
	email: string;
}

async function findTestJob(): Promise<JobData | null> {
	console.log('\n🔍 Looking for a job to test with...');

	const jobs = await sql<JobData[]>`
		SELECT j.id, j.title, j.company, j.user_id
		FROM jobs j
		WHERE j.title IS NOT NULL
			AND j.company IS NOT NULL
			AND j.user_id IS NOT NULL
		ORDER BY j.created_at DESC
		LIMIT 1
	`;

	if (jobs.length === 0) {
		return null;
	}

	const job = jobs[0];
	console.log(`✅ Found job: ${job.title} at ${job.company} (ID: ${job.id})`);
	return job;
}

async function findTestProfile(userId: string): Promise<ProfileData | null> {
	console.log(`\n🔍 Looking for profile for user ${userId}...`);

	const profiles = await sql<ProfileData[]>`
		SELECT id, full_name, email
		FROM profiles
		WHERE user_id = ${userId}
		LIMIT 1
	`;

	if (profiles.length === 0) {
		return null;
	}

	const profile = profiles[0];
	console.log(`✅ Found profile: ${profile.full_name} (${profile.email})`);
	return profile;
}

async function triggerResumeGeneration(
	jobId: string,
	userId: string
): Promise<{ eventId: string }> {
	console.log('\n🚀 Sending resume generation event to Inngest...');

	const result = await inngest.send({
		name: 'job/resume.generate',
		data: {
			jobId,
			userId,
			options: {
				includeResearch: true,
				useLibrary: true,
				qualityThreshold: 70
			}
		}
	});

	console.log(`✅ Event sent successfully!`);
	console.log(`   Event IDs: ${result.ids.join(', ')}`);

	return { eventId: result.ids[0] };
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
	console.log('═══════════════════════════════════════════════════════════════');
	console.log('         ResumeGenerationAgentV2 Test via Inngest');
	console.log('═══════════════════════════════════════════════════════════════');

	try {
		// Find a job to test with
		const job = await findTestJob();
		if (!job) {
			console.log('\n⚠️ No jobs found in database. Creating a test job...');

			// Create a sample job for testing
			const sampleJob = await sql`
				INSERT INTO jobs (
					title, company, description, requirements, location,
					is_remote, user_id, source, source_url
				) VALUES (
					'Senior Software Engineer',
					'TechCorp Inc.',
					${'We are looking for a Senior Software Engineer with 5+ years of experience in TypeScript, Node.js, React, and PostgreSQL. Experience with cloud platforms and CI/CD is required.'},
					${JSON.stringify(['TypeScript', 'Node.js', 'React', 'PostgreSQL', 'AWS'])}::jsonb,
					'San Francisco, CA',
					true,
					(SELECT id FROM auth.users LIMIT 1),
					'manual',
					'https://example.com/test-job'
				)
				RETURNING id, title, company, user_id
			`;

			if (sampleJob.length === 0) {
				console.error('❌ Failed to create sample job');
				process.exit(1);
			}

			console.log(`✅ Created sample job: ${sampleJob[0].title}`);
		}

		const testJob = job || (await findTestJob());
		if (!testJob) {
			console.error('❌ Could not find or create test job');
			process.exit(1);
		}

		// Find the profile
		const profile = await findTestProfile(testJob.user_id);
		if (!profile) {
			console.log('\n⚠️ No profile found for user. The agent will handle this.');
		}

		// Trigger the Inngest function
		const { eventId } = await triggerResumeGeneration(testJob.id, testJob.user_id);

		console.log('\n═══════════════════════════════════════════════════════════════');
		console.log('                        Test Complete');
		console.log('═══════════════════════════════════════════════════════════════');
		console.log('\n📊 Monitor the function execution in the Inngest dashboard:');
		console.log('   https://app.inngest.com/env/production/functions');
		console.log('\n   Or check locally at: http://localhost:8288');
		console.log(`\n   Event ID: ${eventId}`);
		console.log('\n✅ The ResumeGenerationAgentV2 will now process this job.');
		console.log('   Check the database for results in the generated_resumes table.\n');
	} catch (error) {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

main();
