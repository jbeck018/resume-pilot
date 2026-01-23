// =============================================================================
// Job Analysis Helper
// =============================================================================
// Provides server-side job analysis for computing match breakdowns, ATS scores,
// and skills gap analysis without using mock data

import type { Database } from '$lib/server/database/types';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface MatchBreakdown {
	skillsMatch: number;
	experienceMatch: number;
	educationMatch: number;
}

export interface ATSAnalysis {
	score: number;
	keywordsMatched: string[];
	keywordsMissing: string[];
	suggestions: string[];
}

export interface SkillsGap {
	matchedSkills: string[];
	missingRequired: string[];
	missingPreferred: string[];
}

/**
 * Extract keywords from text (job description)
 */
function extractKeywords(text: string): string[] {
	if (!text) return [];

	// Common technical and professional keywords
	const keywordPatterns = [
		// Programming languages
		/\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|Ruby|Go|Rust|PHP|Swift|Kotlin)\b/gi,
		// Frameworks
		/\b(React|Vue|Angular|Svelte|Next\.js|Express|Django|Flask|Spring|Laravel)\b/gi,
		// Databases
		/\b(PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|DynamoDB|Cassandra)\b/gi,
		// Cloud & DevOps
		/\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|GitLab|CircleCI|Terraform)\b/gi,
		// Methodologies
		/\b(Agile|Scrum|CI\/CD|TDD|DevOps|Microservices)\b/gi,
		// Other tech
		/\b(REST|GraphQL|API|Git|Node\.js|SQL|NoSQL)\b/gi
	];

	const keywords = new Set<string>();

	keywordPatterns.forEach((pattern) => {
		const matches = text.match(pattern);
		if (matches) {
			matches.forEach((match) => keywords.add(match));
		}
	});

	return Array.from(keywords);
}

/**
 * Normalize skill for comparison
 */
function normalizeSkill(skill: string): string {
	return skill.toLowerCase().trim();
}

/**
 * Check if two skills match (including common aliases)
 */
function doSkillsMatch(skill1: string, skill2: string): boolean {
	const norm1 = normalizeSkill(skill1);
	const norm2 = normalizeSkill(skill2);

	if (norm1 === norm2) return true;

	// Common aliases
	const aliases: Record<string, string[]> = {
		javascript: ['js', 'ecmascript', 'es6'],
		typescript: ['ts'],
		'node.js': ['nodejs', 'node'],
		'react': ['reactjs', 'react.js'],
		postgresql: ['postgres', 'psql'],
		mongodb: ['mongo']
	};

	for (const [primary, aliasList] of Object.entries(aliases)) {
		if ((norm1 === primary || aliasList.includes(norm1)) &&
		    (norm2 === primary || aliasList.includes(norm2))) {
			return true;
		}
	}

	// Substring match
	return norm1.includes(norm2) || norm2.includes(norm1);
}

/**
 * Calculate match breakdown comparing job to profile
 */
export function calculateMatchBreakdown(
	job: JobRow,
	profile: ProfileRow
): MatchBreakdown {
	const baseScore = job.match_score || 60;

	// Extract keywords from job description
	const jobKeywords = extractKeywords(job.description || '');
	const profileSkills = profile.skills || [];

	// Calculate skills match
	let matchedCount = 0;
	jobKeywords.forEach((keyword) => {
		if (profileSkills.some((skill) => doSkillsMatch(keyword, skill))) {
			matchedCount++;
		}
	});

	const skillsMatch = jobKeywords.length > 0
		? Math.round((matchedCount / jobKeywords.length) * 100)
		: baseScore;

	// Calculate experience match based on job level
	const experienceData = (profile.experience as any) || [];
	const totalYears = calculateTotalExperience(experienceData);

	let experienceMatch = baseScore;
	const jobLevel = (job.experience_level || '').toLowerCase();

	if (jobLevel.includes('entry') || jobLevel.includes('junior')) {
		experienceMatch = totalYears >= 0 ? 90 : 60;
	} else if (jobLevel.includes('mid')) {
		experienceMatch = totalYears >= 2 ? 90 : totalYears >= 1 ? 70 : 50;
	} else if (jobLevel.includes('senior')) {
		experienceMatch = totalYears >= 5 ? 95 : totalYears >= 3 ? 70 : 40;
	}

	// Calculate education match
	const educationData = (profile.education as any) || [];
	const hasDegree = educationData.length > 0;
	const educationMatch = hasDegree ? 85 : 60;

	return {
		skillsMatch: Math.min(100, skillsMatch),
		experienceMatch: Math.min(100, experienceMatch),
		educationMatch: Math.min(100, educationMatch)
	};
}

/**
 * Calculate total years of experience
 */
function calculateTotalExperience(experience: any[]): number {
	if (!Array.isArray(experience)) return 0;

	let totalMonths = 0;

	for (const exp of experience) {
		const start = parseDate(exp.startDate);
		const end = exp.current ? new Date() : parseDate(exp.endDate);

		if (start && end) {
			const months = (end.getFullYear() - start.getFullYear()) * 12 +
			               (end.getMonth() - start.getMonth());
			totalMonths += Math.max(0, months);
		}
	}

	return Math.round((totalMonths / 12) * 10) / 10;
}

/**
 * Parse date string
 */
function parseDate(dateStr: string | undefined): Date | null {
	if (!dateStr) return null;

	try {
		return new Date(dateStr);
	} catch {
		return null;
	}
}

/**
 * Analyze ATS compatibility
 */
export function analyzeATS(job: JobRow, profile: ProfileRow): ATSAnalysis {
	const jobKeywords = extractKeywords(job.description || '');
	const jobRequirements = job.requirements || [];

	// Combine job keywords and requirements
	const allJobKeywords = new Set([
		...jobKeywords,
		...jobRequirements.flatMap(req => extractKeywords(req))
	]);

	const profileSkills = profile.skills || [];
	const matched: string[] = [];
	const missing: string[] = [];

	allJobKeywords.forEach((keyword) => {
		if (profileSkills.some((skill) => doSkillsMatch(keyword, skill))) {
			matched.push(keyword);
		} else {
			missing.push(keyword);
		}
	});

	// Calculate ATS score based on keyword match rate
	const score = allJobKeywords.size > 0
		? Math.round((matched.length / allJobKeywords.size) * 100)
		: 70;

	// Generate suggestions
	const suggestions: string[] = [];

	if (missing.length > 0) {
		suggestions.push('Add relevant keywords from the job description to your resume');
	}

	if (score < 60) {
		suggestions.push('Include quantified achievements with metrics');
		suggestions.push('Match job title keywords in your experience section');
	}

	if (!profile.summary) {
		suggestions.push('Add a professional summary highlighting key qualifications');
	}

	return {
		score: Math.min(100, Math.max(0, score)),
		keywordsMatched: matched.slice(0, 10), // Top 10
		keywordsMissing: missing.slice(0, 5),   // Top 5
		suggestions: suggestions.length > 0 ? suggestions : ['Your profile looks well-optimized for ATS']
	};
}

/**
 * Analyze skills gap between job and profile
 */
export function analyzeSkillsGap(job: JobRow, profile: ProfileRow): SkillsGap {
	const jobKeywords = extractKeywords(job.description || '');
	const jobRequirements = job.requirements || [];

	// Extract required vs preferred skills
	const requiredSkills = new Set<string>();
	const preferredSkills = new Set<string>();

	jobRequirements.forEach((req) => {
		const reqLower = req.toLowerCase();
		const keywords = extractKeywords(req);

		if (reqLower.includes('required') || reqLower.includes('must have')) {
			keywords.forEach(k => requiredSkills.add(k));
		} else if (reqLower.includes('preferred') || reqLower.includes('nice to have')) {
			keywords.forEach(k => preferredSkills.add(k));
		} else {
			// Default to required if not specified
			keywords.forEach(k => requiredSkills.add(k));
		}
	});

	// Add keywords from description as preferred
	jobKeywords.forEach(k => {
		if (!requiredSkills.has(k)) {
			preferredSkills.add(k);
		}
	});

	const profileSkills = profile.skills || [];
	const matched: string[] = [];
	const missingRequired: string[] = [];
	const missingPreferred: string[] = [];

	// Check required skills
	requiredSkills.forEach((skill) => {
		if (profileSkills.some((pSkill) => doSkillsMatch(skill, pSkill))) {
			matched.push(skill);
		} else {
			missingRequired.push(skill);
		}
	});

	// Check preferred skills
	preferredSkills.forEach((skill) => {
		if (profileSkills.some((pSkill) => doSkillsMatch(skill, pSkill))) {
			if (!matched.includes(skill)) {
				matched.push(skill);
			}
		} else {
			missingPreferred.push(skill);
		}
	});

	return {
		matchedSkills: matched,
		missingRequired: missingRequired.slice(0, 5),    // Top 5
		missingPreferred: missingPreferred.slice(0, 5)   // Top 5
	};
}
