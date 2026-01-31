/**
 * Test script for ResumeGenerationAgentV2
 *
 * This script tests the Resume Generation Agent V2 with real data from the database.
 * It fetches a job and profile from the database and runs the agent to generate a tailored resume.
 *
 * Usage: npx tsx src/lib/server/agents/tests/test-resume-v2.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Langfuse } from 'langfuse';
import { desc, eq, isNotNull } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { ResumeGenerationAgentV2 } from '../agents/resume-generation-v2';
import type { AgentContext, JobInfo, ProfileInfo, ExperienceItem, EducationItem } from '../types';

// =============================================================================
// Configuration
// =============================================================================

const TEST_OPTIONS = {
	includeResearch: true,
	useLibrary: true,
	qualityThreshold: 70
};

// Sample data to use if no real data exists in the database
const SAMPLE_JOB: JobInfo = {
	id: 'sample-job-001',
	title: 'Senior Software Engineer',
	company: 'TechCorp Inc.',
	description: `We are looking for a Senior Software Engineer to join our team.

Requirements:
- 5+ years of experience with TypeScript and Node.js
- Strong experience with React or similar frontend frameworks
- Experience with PostgreSQL and database design
- Understanding of CI/CD pipelines and DevOps practices
- Experience with cloud platforms (AWS/GCP/Azure)

Nice to have:
- Experience with Kubernetes and Docker
- GraphQL experience
- Previous experience in a startup environment

Responsibilities:
- Lead the design and implementation of new features
- Mentor junior developers
- Participate in code reviews
- Contribute to architectural decisions`,
	requirements: [
		'5+ years TypeScript/Node.js',
		'React experience',
		'PostgreSQL',
		'CI/CD experience',
		'Cloud platforms (AWS/GCP/Azure)'
	],
	location: 'San Francisco, CA',
	isRemote: true,
	salaryMin: 150000,
	salaryMax: 200000,
	experienceLevel: 'senior',
	employmentType: 'full-time',
	sourceUrl: 'https://example.com/jobs/senior-software-engineer'
};

const SAMPLE_PROFILE: ProfileInfo = {
	id: 'sample-profile-001',
	fullName: 'John Developer',
	email: 'john.developer@example.com',
	headline: 'Full Stack Engineer with 6+ years experience',
	summary:
		'Passionate software engineer with expertise in building scalable web applications. Experienced in leading teams and delivering high-quality products.',
	location: 'San Francisco, CA',
	skills: [
		'TypeScript',
		'JavaScript',
		'Node.js',
		'React',
		'PostgreSQL',
		'AWS',
		'Docker',
		'Git',
		'Python',
		'REST APIs',
		'GraphQL',
		'MongoDB'
	],
	experience: [
		{
			title: 'Senior Software Engineer',
			company: 'StartupXYZ',
			location: 'San Francisco, CA',
			startDate: '2021-06',
			current: true,
			description:
				'Led development of core platform features using TypeScript and React. Implemented CI/CD pipelines with GitHub Actions. Mentored 3 junior developers. Improved application performance by 40%.',
			skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS']
		},
		{
			title: 'Software Engineer',
			company: 'BigTech Corp',
			location: 'San Francisco, CA',
			startDate: '2018-03',
			endDate: '2021-05',
			current: false,
			description:
				'Developed microservices architecture handling 1M+ daily requests. Built real-time data processing pipelines. Contributed to open-source projects.',
			skills: ['JavaScript', 'Node.js', 'MongoDB', 'Docker', 'Kubernetes']
		}
	],
	education: [
		{
			institution: 'University of California, Berkeley',
			degree: 'Bachelor of Science',
			field: 'Computer Science',
			startDate: '2014',
			endDate: '2018'
		}
	],
	linkedinUrl: 'https://linkedin.com/in/johndeveloper',
	githubHandle: 'johndeveloper'
};

// =============================================================================
// Database Connection
// =============================================================================

function getDb() {
	const dbUrl = process.env.SUPABASE_DB_URL;
	if (!dbUrl) {
		throw new Error('SUPABASE_DB_URL environment variable is required');
	}

	const client = postgres(dbUrl, {
		prepare: false,
		max: 1
	});

	return drizzle(client, { schema });
}

// =============================================================================
// Data Fetching
// =============================================================================

async function fetchRealJobFromDb(
	db: ReturnType<typeof getDb>
): Promise<(typeof schema.jobs.$inferSelect) | null> {
	try {
		// Get a job that has a description
		const [job] = await db
			.select()
			.from(schema.jobs)
			.where(isNotNull(schema.jobs.description))
			.orderBy(desc(schema.jobs.createdAt))
			.limit(1);

		return job || null;
	} catch (error) {
		console.error('Error fetching job:', error);
		return null;
	}
}

async function fetchRealProfileFromDb(
	db: ReturnType<typeof getDb>,
	userId?: string
): Promise<(typeof schema.profiles.$inferSelect) | null> {
	try {
		let query = db
			.select()
			.from(schema.profiles)
			.orderBy(desc(schema.profiles.updatedAt))
			.limit(1);

		if (userId) {
			query = db
				.select()
				.from(schema.profiles)
				.where(eq(schema.profiles.userId, userId))
				.limit(1);
		}

		const [profile] = await query;
		return profile || null;
	} catch (error) {
		console.error('Error fetching profile:', error);
		return null;
	}
}

function convertDbJobToJobInfo(dbJob: typeof schema.jobs.$inferSelect): JobInfo {
	return {
		id: dbJob.id,
		title: dbJob.title,
		company: dbJob.company,
		description: dbJob.description || '',
		requirements: dbJob.requirements || undefined,
		benefits: dbJob.benefits || undefined,
		location: dbJob.location || undefined,
		isRemote: dbJob.isRemote || false,
		salaryMin: dbJob.salaryMin || undefined,
		salaryMax: dbJob.salaryMax || undefined,
		experienceLevel: dbJob.experienceLevel || undefined,
		employmentType: dbJob.employmentType || undefined,
		sourceUrl: dbJob.sourceUrl
	};
}

function convertDbProfileToProfileInfo(
	dbProfile: typeof schema.profiles.$inferSelect
): ProfileInfo {
	// Extract experience from JSON
	const experience: ExperienceItem[] = ((dbProfile.experience as unknown[]) || []).map(
		(exp: unknown) => {
			const e = exp as Record<string, unknown>;
			return {
				title: (e.title as string) || '',
				company: (e.company as string) || '',
				location: e.location as string | undefined,
				startDate: (e.startDate as string) || '',
				endDate: e.endDate as string | undefined,
				current: Boolean(e.current),
				description: e.description as string | undefined,
				skills: e.skills as string[] | undefined
			};
		}
	);

	// Extract education from JSON
	const education: EducationItem[] = ((dbProfile.education as unknown[]) || []).map(
		(edu: unknown) => {
			const e = edu as Record<string, unknown>;
			return {
				institution: (e.institution as string) || '',
				degree: (e.degree as string) || '',
				field: e.field as string | undefined,
				startDate: e.startDate as string | undefined,
				endDate: e.endDate as string | undefined,
				gpa: e.gpa as string | undefined
			};
		}
	);

	return {
		id: dbProfile.id,
		fullName: dbProfile.fullName || 'Unknown',
		email: dbProfile.email || undefined,
		headline: dbProfile.headline || undefined,
		summary: dbProfile.summary || undefined,
		location: dbProfile.location || undefined,
		skills: (dbProfile.skills as string[]) || [],
		experience,
		education,
		linkedinUrl: dbProfile.linkedinUrl || undefined,
		githubHandle: dbProfile.githubHandle || undefined,
		minSalary: dbProfile.minSalary || undefined,
		maxSalary: dbProfile.maxSalary || undefined
	};
}

// =============================================================================
// Test Execution
// =============================================================================

async function runTest() {
	console.log('='.repeat(80));
	console.log('RESUME GENERATION AGENT V2 - TEST SCRIPT');
	console.log('='.repeat(80));
	console.log();

	let db: ReturnType<typeof getDb> | null = null;
	let job: JobInfo;
	let profile: ProfileInfo;
	let userId: string;

	// Try to fetch real data from database
	try {
		db = getDb();
		console.log('[INFO] Connected to database successfully');

		const dbJob = await fetchRealJobFromDb(db);
		const dbProfile = await fetchRealProfileFromDb(db, dbJob?.userId);

		if (dbJob && dbProfile) {
			console.log('[INFO] Using REAL data from database');
			job = convertDbJobToJobInfo(dbJob);
			profile = convertDbProfileToProfileInfo(dbProfile);
			userId = dbProfile.userId;
		} else {
			console.log('[INFO] No real data found, using SAMPLE data');
			job = SAMPLE_JOB;
			profile = SAMPLE_PROFILE;
			userId = 'sample-user-001';
		}
	} catch (error) {
		console.log('[WARN] Database connection failed, using SAMPLE data');
		console.log('[WARN] Error:', error instanceof Error ? error.message : 'Unknown error');
		job = SAMPLE_JOB;
		profile = SAMPLE_PROFILE;
		userId = 'sample-user-001';
	}

	console.log();
	console.log('-'.repeat(80));
	console.log('JOB DETAILS');
	console.log('-'.repeat(80));
	console.log(`Title: ${job.title}`);
	console.log(`Company: ${job.company}`);
	console.log(`Location: ${job.location || 'Not specified'} ${job.isRemote ? '(Remote)' : ''}`);
	console.log(`Experience Level: ${job.experienceLevel || 'Not specified'}`);
	if (job.salaryMin || job.salaryMax) {
		console.log(
			`Salary Range: $${job.salaryMin?.toLocaleString() || '?'} - $${job.salaryMax?.toLocaleString() || '?'}`
		);
	}
	console.log(`Description length: ${job.description.length} characters`);

	console.log();
	console.log('-'.repeat(80));
	console.log('PROFILE DETAILS');
	console.log('-'.repeat(80));
	console.log(`Name: ${profile.fullName}`);
	console.log(`Headline: ${profile.headline || 'Not set'}`);
	console.log(`Location: ${profile.location || 'Not set'}`);
	console.log(`Skills: ${profile.skills.slice(0, 10).join(', ')}${profile.skills.length > 10 ? ` (+${profile.skills.length - 10} more)` : ''}`);
	console.log(`Experience entries: ${profile.experience.length}`);
	console.log(`Education entries: ${profile.education.length}`);

	console.log();
	console.log('-'.repeat(80));
	console.log('RUNNING AGENT');
	console.log('-'.repeat(80));
	console.log(`Options: includeResearch=${TEST_OPTIONS.includeResearch}, useLibrary=${TEST_OPTIONS.useLibrary}, qualityThreshold=${TEST_OPTIONS.qualityThreshold}`);
	console.log();

	// Create Langfuse trace
	let langfuse: Langfuse | null = null;
	try {
		const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
		const secretKey = process.env.LANGFUSE_SECRET_KEY;

		if (publicKey && secretKey) {
			langfuse = new Langfuse({
				publicKey,
				secretKey,
				baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com'
			});
			console.log('[INFO] Langfuse tracing enabled');
		} else {
			console.log('[INFO] Langfuse tracing disabled (no credentials)');
		}
	} catch (error) {
		console.log('[WARN] Failed to initialize Langfuse:', error);
	}

	// Create trace
	const trace =
		langfuse?.trace({
			name: 'test-resume-generation-v2',
			metadata: {
				testRun: true,
				jobId: job.id,
				jobTitle: job.title,
				company: job.company
			}
		}) ||
		({
			id: 'mock-trace-id',
			span: () => ({
				span: () => ({
					span: () => ({}),
					end: () => {},
					event: () => {},
					update: () => {},
					generation: () => ({ end: () => {} })
				}),
				end: () => {},
				event: () => {},
				update: () => {},
				generation: () => ({ end: () => {} })
			}),
			update: () => {},
			event: () => {}
		} as unknown as ReturnType<Langfuse['trace']>);

	// Create context
	const context: AgentContext = {
		userId,
		jobId: job.id,
		trace,
		parentSpan: trace.span({ name: 'test-parent' }),
		metadata: {
			testRun: true
		}
	};

	// Execute agent
	const agent = new ResumeGenerationAgentV2();
	const startTime = Date.now();

	try {
		console.log('[INFO] Starting resume generation...');
		console.log();

		const result = await agent.execute(
			{
				job,
				profile,
				options: TEST_OPTIONS
			},
			context
		);

		const duration = Date.now() - startTime;

		console.log();
		console.log('='.repeat(80));
		console.log('RESULTS');
		console.log('='.repeat(80));

		if (result.success && result.data) {
			const data = result.data;

			console.log();
			console.log('[SUCCESS] Resume generated successfully!');
			console.log();

			// Scores
			console.log('-'.repeat(80));
			console.log('SCORES');
			console.log('-'.repeat(80));
			console.log(`Match Score:    ${data.matchScore}%`);
			console.log(`ATS Score:      ${data.atsScore}%`);
			console.log(`Quality Score:  ${data.qualityScore}%`);

			// Confidence tier calculation
			let confidenceTier: string;
			if (data.matchScore >= 80) {
				confidenceTier = 'EXCELLENT (Direct match)';
			} else if (data.matchScore >= 60) {
				confidenceTier = 'GOOD (Transferable)';
			} else if (data.matchScore >= 40) {
				confidenceTier = 'FAIR (Adjacent)';
			} else {
				confidenceTier = 'WEAK (Significant gaps)';
			}
			console.log(`Confidence Tier: ${confidenceTier}`);

			// Gap Analysis
			console.log();
			console.log('-'.repeat(80));
			console.log('GAP ANALYSIS');
			console.log('-'.repeat(80));
			console.log(`Total gaps found: ${data.gaps.length}`);

			if (data.gaps.length > 0) {
				const criticalGaps = data.gaps.filter((g) => g.severity === 'critical');
				const significantGaps = data.gaps.filter((g) => g.severity === 'significant');
				const minorGaps = data.gaps.filter((g) => g.severity === 'minor');

				console.log(`  - Critical: ${criticalGaps.length}`);
				console.log(`  - Significant: ${significantGaps.length}`);
				console.log(`  - Minor: ${minorGaps.length}`);

				if (criticalGaps.length > 0) {
					console.log();
					console.log('Critical gaps:');
					criticalGaps.forEach((gap) => {
						console.log(`  * ${gap.requirement} (${gap.gapType})`);
					});
				}
			}

			// Reframing Strategies
			console.log();
			console.log('-'.repeat(80));
			console.log('REFRAMING STRATEGIES');
			console.log('-'.repeat(80));
			const reframingCount = data.assemblyPlan.reframingPlan.length;
			console.log(`Strategies applied: ${reframingCount}`);

			if (reframingCount > 0) {
				data.assemblyPlan.reframingPlan.slice(0, 3).forEach((plan) => {
					console.log(`  * ${plan.strategy.type}: ${plan.priority} priority`);
				});
				if (reframingCount > 3) {
					console.log(`  ... and ${reframingCount - 3} more`);
				}
			}

			// Highlights
			console.log();
			console.log('-'.repeat(80));
			console.log('KEY HIGHLIGHTS');
			console.log('-'.repeat(80));
			data.highlights.forEach((highlight) => {
				console.log(`  * ${highlight}`);
			});

			// Matched Requirements
			console.log();
			console.log('-'.repeat(80));
			console.log('MATCHED REQUIREMENTS');
			console.log('-'.repeat(80));
			const directMatches = data.matchedRequirements.filter((m) => m.confidence.tier === 'direct');
			const transferableMatches = data.matchedRequirements.filter(
				(m) => m.confidence.tier === 'transferable'
			);
			const adjacentMatches = data.matchedRequirements.filter(
				(m) => m.confidence.tier === 'adjacent'
			);

			console.log(`Total requirements analyzed: ${data.matchedRequirements.length}`);
			console.log(`  - Direct matches: ${directMatches.length}`);
			console.log(`  - Transferable: ${transferableMatches.length}`);
			console.log(`  - Adjacent: ${adjacentMatches.length}`);

			// Performance
			console.log();
			console.log('-'.repeat(80));
			console.log('PERFORMANCE');
			console.log('-'.repeat(80));
			console.log(`Total duration: ${duration}ms`);
			console.log(`Generation attempts: ${data.generationAttempts}`);
			if (data.metadata) {
				if (data.metadata.phase0DurationMs) {
					console.log(`  Phase 0 (Library): ${data.metadata.phase0DurationMs}ms`);
				}
				console.log(`  Phase 1 (Research): ${data.metadata.phase1DurationMs}ms`);
				console.log(`  Phase 2 (Template): ${data.metadata.phase2DurationMs}ms`);
				if (data.metadata.phase25DurationMs) {
					console.log(`  Phase 2.5 (Discovery): ${data.metadata.phase25DurationMs}ms`);
				}
				console.log(`  Phase 3 (Assembly): ${data.metadata.phase3DurationMs}ms`);
				console.log(`  Phase 4 (Generation): ${data.metadata.phase4DurationMs}ms`);
				if (data.metadata.phase5DurationMs) {
					console.log(`  Phase 5 (Library Update): ${data.metadata.phase5DurationMs}ms`);
				}
			}

			// Resume Preview
			console.log();
			console.log('-'.repeat(80));
			console.log('RESUME PREVIEW (first 500 characters)');
			console.log('-'.repeat(80));
			console.log(data.resume.slice(0, 500));
			if (data.resume.length > 500) {
				console.log(`... (${data.resume.length - 500} more characters)`);
			}

			// Library patterns if used
			if (data.libraryPatternsApplied && data.libraryPatternsApplied.length > 0) {
				console.log();
				console.log('-'.repeat(80));
				console.log('LIBRARY PATTERNS APPLIED');
				console.log('-'.repeat(80));
				data.libraryPatternsApplied.forEach((pattern) => {
					console.log(`  * ${pattern.patternType}: ${pattern.description} (${pattern.confidence}% confidence)`);
				});
			}

			// Company Research
			if (data.companyResearch) {
				console.log();
				console.log('-'.repeat(80));
				console.log('COMPANY RESEARCH');
				console.log('-'.repeat(80));
				console.log(`Industry: ${data.companyResearch.industry || 'N/A'}`);
				if (data.companyResearch.culture) {
					console.log(`Culture: ${data.companyResearch.culture.join(', ')}`);
				}
				if (data.companyResearch.technologies) {
					console.log(`Technologies: ${data.companyResearch.technologies.join(', ')}`);
				}
				if (data.companyResearch.values) {
					console.log(`Values: ${data.companyResearch.values.join(', ')}`);
				}
			}

			console.log();
			console.log('='.repeat(80));
			console.log('TEST PASSED');
			console.log('='.repeat(80));
		} else {
			console.log();
			console.log('[FAILURE] Resume generation failed!');
			console.log(`Error: ${result.error}`);
			console.log(`Error Code: ${result.errorCode}`);
			console.log(`Duration: ${duration}ms`);
			console.log();
			console.log('='.repeat(80));
			console.log('TEST FAILED');
			console.log('='.repeat(80));
			process.exit(1);
		}
	} catch (error) {
		const duration = Date.now() - startTime;
		console.log();
		console.log('[ERROR] Unexpected error during test execution:');
		console.log(error instanceof Error ? error.message : 'Unknown error');
		if (error instanceof Error && error.stack) {
			console.log();
			console.log('Stack trace:');
			console.log(error.stack);
		}
		console.log();
		console.log(`Duration: ${duration}ms`);
		console.log();
		console.log('='.repeat(80));
		console.log('TEST FAILED');
		console.log('='.repeat(80));
		process.exit(1);
	} finally {
		// Flush Langfuse
		if (langfuse) {
			await langfuse.flushAsync();
		}
	}
}

// Run the test
runTest().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
