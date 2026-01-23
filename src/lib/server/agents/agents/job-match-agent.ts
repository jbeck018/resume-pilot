// =============================================================================
// Job Match Agent
// =============================================================================

import { BaseAgent } from '../core/base-agent';
import type {
	AgentConfig,
	AgentContext,
	JobMatchAgentInput,
	JobMatchAgentOutput,
	ExtractedSkill
} from '../types';
import { SkillExtractorTool } from '../tools/skill-extractor';
import { ProfileAnalyzerTool } from '../tools/profile-analyzer';

/**
 * Job Match Agent
 * Scores and ranks job-profile matches with detailed breakdown
 */
export class JobMatchAgent extends BaseAgent<JobMatchAgentInput, JobMatchAgentOutput> {
	constructor() {
		const config: AgentConfig = {
			id: 'job-match-agent',
			name: 'Job Matching Agent',
			description: 'Calculates job-profile match scores with detailed analysis',
			defaultModel: 'gemini-1.5-flash', // Fast model for matching
			maxRetries: 2,
			timeoutMs: 30000,
			priority: 'normal'
		};

		super(config);

		// Register tools
		this.registerTool(SkillExtractorTool);
		this.registerTool(ProfileAnalyzerTool);
	}

	protected async executeInternal(
		input: JobMatchAgentInput,
		context: AgentContext
	): Promise<JobMatchAgentOutput> {
		const { job, profile, options } = input;

		// Default weights
		const weights = {
			skills: options?.weights?.skills ?? 0.35,
			experience: options?.weights?.experience ?? 0.30,
			education: options?.weights?.education ?? 0.15,
			location: options?.weights?.location ?? 0.10,
			salary: options?.weights?.salary ?? 0.10
		};

		// Step 1: Extract skills from job description
		const jobSkills = await this.executeTool<
			{ text: string; context: 'job_description' },
			{ skills: ExtractedSkill[]; requiredCount: number; preferredCount: number }
		>('skill-extractor', { text: job.description, context: 'job_description' }, context);

		// Step 2: Extract skills from profile
		const profileSkillsText = [
			profile.skills.join(', '),
			...profile.experience.map((e) => `${e.title}: ${e.description || ''} ${e.skills?.join(', ') || ''}`),
			...profile.education.map((e) => `${e.degree} ${e.field || ''}`)
		].join('\n');

		const profileSkills = await this.executeTool<
			{ text: string; context: 'profile' },
			{ skills: ExtractedSkill[] }
		>('skill-extractor', { text: profileSkillsText, context: 'profile' }, context);

		// Step 3: Calculate individual scores
		const skillsScore = this.calculateSkillsScore(jobSkills.skills, profileSkills.skills, profile.skills);
		const experienceScore = this.calculateExperienceScore(job, profile);
		const educationScore = this.calculateEducationScore(job, profile);
		const locationScore = this.calculateLocationScore(job, profile);
		const salaryScore = this.calculateSalaryScore(job, profile);

		// Step 4: Calculate overall weighted score
		const overallScore = Math.round(
			skillsScore.score * weights.skills +
				experienceScore.score * weights.experience +
				educationScore.score * weights.education +
				locationScore.score * weights.location +
				salaryScore.score * weights.salary
		);

		// Step 5: Generate insights using LLM
		const insights = await this.generateInsights(
			input,
			{
				overall: overallScore,
				skills: skillsScore,
				experience: experienceScore,
				education: educationScore,
				location: locationScore,
				salary: salaryScore
			},
			context
		);

		return {
			overallScore,
			breakdown: {
				skills: skillsScore,
				experience: experienceScore,
				education: educationScore,
				location: locationScore,
				salary: salaryScore
			},
			matchReasons: insights.reasons,
			suggestions: insights.suggestions,
			concerns: insights.concerns
		};
	}

	private calculateSkillsScore(
		jobSkills: ExtractedSkill[],
		profileSkills: ExtractedSkill[],
		rawProfileSkills: string[]
	): { score: number; matched: string[]; missing: string[] } {
		const profileSkillNames = new Set([
			...profileSkills.map((s) => s.name.toLowerCase()),
			...rawProfileSkills.map((s) => s.toLowerCase())
		]);

		const requiredSkills = jobSkills.filter((s) => s.importance === 'required');
		const preferredSkills = jobSkills.filter((s) => s.importance !== 'required');

		// Match skills
		const matchedRequired = requiredSkills.filter((s) =>
			this.skillMatches(s.name, profileSkillNames)
		);
		const matchedPreferred = preferredSkills.filter((s) =>
			this.skillMatches(s.name, profileSkillNames)
		);

		// Calculate score
		// Required skills worth 70% of skills score, preferred worth 30%
		const requiredScore =
			requiredSkills.length > 0 ? (matchedRequired.length / requiredSkills.length) * 70 : 70;
		const preferredScore =
			preferredSkills.length > 0 ? (matchedPreferred.length / preferredSkills.length) * 30 : 30;

		const matched = [...matchedRequired, ...matchedPreferred].map((s) => s.name);
		const missing = requiredSkills
			.filter((s) => !this.skillMatches(s.name, profileSkillNames))
			.map((s) => s.name);

		return {
			score: Math.round(requiredScore + preferredScore),
			matched,
			missing
		};
	}

	private skillMatches(skillName: string, profileSkills: Set<string>): boolean {
		const normalized = skillName.toLowerCase();

		// Direct match
		if (profileSkills.has(normalized)) return true;

		// Check for partial matches and common aliases
		const aliases: Record<string, string[]> = {
			javascript: ['js', 'ecmascript', 'es6', 'es2015'],
			typescript: ['ts'],
			react: ['reactjs', 'react.js'],
			node: ['nodejs', 'node.js'],
			python: ['py'],
			postgresql: ['postgres', 'psql'],
			mongodb: ['mongo'],
			kubernetes: ['k8s'],
			docker: ['containerization'],
			aws: ['amazon web services'],
			gcp: ['google cloud', 'google cloud platform'],
			azure: ['microsoft azure']
		};

		// Check aliases
		for (const [primary, aliasList] of Object.entries(aliases)) {
			if (normalized === primary || aliasList.includes(normalized)) {
				if (profileSkills.has(primary) || aliasList.some((a) => profileSkills.has(a))) {
					return true;
				}
			}
		}

		// Check for substring matches (e.g., "React Native" matches "React")
		for (const profileSkill of profileSkills) {
			if (profileSkill.includes(normalized) || normalized.includes(profileSkill)) {
				return true;
			}
		}

		return false;
	}

	private calculateExperienceScore(
		job: JobMatchAgentInput['job'],
		profile: JobMatchAgentInput['profile']
	): { score: number; relevance: string } {
		const totalYears = this.calculateTotalExperience(profile.experience);

		// Determine required experience level
		const expLevel = job.experienceLevel?.toLowerCase() || '';
		const description = job.description.toLowerCase();

		let requiredYears = 0;
		let relevance = 'Unknown match';

		if (expLevel.includes('entry') || expLevel.includes('junior') || description.includes('0-2 years')) {
			requiredYears = 1;
			relevance = totalYears >= 0 ? 'Entry-level match' : 'May need more experience';
		} else if (expLevel.includes('mid') || description.includes('3-5 years') || description.includes('2-4 years')) {
			requiredYears = 3;
			relevance = totalYears >= 2 ? 'Mid-level match' : 'Below mid-level requirements';
		} else if (expLevel.includes('senior') || description.includes('5+ years') || description.includes('5-7 years')) {
			requiredYears = 5;
			relevance = totalYears >= 5 ? 'Senior-level match' : 'Below senior requirements';
		} else if (expLevel.includes('lead') || expLevel.includes('principal') || description.includes('7+ years')) {
			requiredYears = 7;
			relevance = totalYears >= 7 ? 'Leadership-level match' : 'Below leadership requirements';
		} else {
			// Default assumption
			requiredYears = 2;
			relevance = totalYears >= 2 ? 'Experience level appears adequate' : 'May need more experience';
		}

		// Calculate score
		let score = Math.min(100, (totalYears / requiredYears) * 100);

		// Check relevance of experience titles
		const relevantRoles = profile.experience.filter((exp) => {
			const titleLower = exp.title.toLowerCase();
			const jobTitleLower = job.title.toLowerCase();

			// Check for similar roles
			return (
				titleLower.includes(jobTitleLower) ||
				jobTitleLower.includes(titleLower) ||
				this.rolesAreSimilar(titleLower, jobTitleLower)
			);
		});

		if (relevantRoles.length > 0) {
			score = Math.min(100, score + 10);
			relevance += ` (${relevantRoles.length} relevant roles)`;
		}

		return { score: Math.round(score), relevance };
	}

	private calculateTotalExperience(
		experience: JobMatchAgentInput['profile']['experience']
	): number {
		let totalMonths = 0;

		for (const exp of experience) {
			const start = this.parseDate(exp.startDate);
			const end = exp.current ? new Date() : this.parseDate(exp.endDate);

			if (start && end) {
				const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
				totalMonths += Math.max(0, months);
			}
		}

		return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal
	}

	private parseDate(dateStr: string | undefined): Date | null {
		if (!dateStr) return null;

		// Handle various date formats
		const formats = [
			/^(\d{4})-(\d{2})/, // 2024-01
			/^(\d{4})\/(\d{2})/, // 2024/01
			/^(\w+)\s+(\d{4})/, // January 2024
			/^(\d{4})$/ // 2024
		];

		for (const format of formats) {
			const match = dateStr.match(format);
			if (match) {
				if (match.length === 2) {
					// Year only
					return new Date(parseInt(match[1]), 0, 1);
				}
				if (match.length === 3) {
					const year = match[1].length === 4 ? parseInt(match[1]) : parseInt(match[2]);
					const month = match[1].length === 4 ? parseInt(match[2]) - 1 : this.parseMonth(match[1]);
					return new Date(year, month, 1);
				}
			}
		}

		return new Date(dateStr);
	}

	private parseMonth(monthStr: string): number {
		const months: Record<string, number> = {
			january: 0, jan: 0,
			february: 1, feb: 1,
			march: 2, mar: 2,
			april: 3, apr: 3,
			may: 4,
			june: 5, jun: 5,
			july: 6, jul: 6,
			august: 7, aug: 7,
			september: 8, sep: 8,
			october: 9, oct: 9,
			november: 10, nov: 10,
			december: 11, dec: 11
		};
		return months[monthStr.toLowerCase()] || 0;
	}

	private rolesAreSimilar(role1: string, role2: string): boolean {
		const roleCategories: Record<string, string[]> = {
			engineering: ['engineer', 'developer', 'programmer', 'coder'],
			design: ['designer', 'ux', 'ui', 'product design'],
			product: ['product manager', 'pm', 'product owner'],
			data: ['data scientist', 'data analyst', 'data engineer', 'ml engineer'],
			devops: ['devops', 'sre', 'platform engineer', 'infrastructure'],
			management: ['manager', 'lead', 'director', 'head of']
		};

		for (const [, keywords] of Object.entries(roleCategories)) {
			const r1Match = keywords.some((k) => role1.includes(k));
			const r2Match = keywords.some((k) => role2.includes(k));
			if (r1Match && r2Match) return true;
		}

		return false;
	}

	private calculateEducationScore(
		job: JobMatchAgentInput['job'],
		profile: JobMatchAgentInput['profile']
	): { score: number; relevance: string } {
		if (profile.education.length === 0) {
			return { score: 50, relevance: 'No education listed' };
		}

		const description = job.description.toLowerCase();

		// Check if degree is required
		const requiresBachelor = description.includes('bachelor') || description.includes("bs ") || description.includes("ba ");
		const requiresMaster = description.includes('master') || description.includes("ms ") || description.includes("ma ");
		const requiresPhd = description.includes('phd') || description.includes('doctorate');

		// Check candidate's highest degree
		const degrees = profile.education.map((e) => e.degree.toLowerCase());
		const hasPhd = degrees.some((d) => d.includes('phd') || d.includes('doctor'));
		const hasMaster = degrees.some((d) => d.includes('master') || d.includes('mba') || d.includes('ms ') || d.includes('ma '));
		const hasBachelor = degrees.some((d) => d.includes('bachelor') || d.includes('bs ') || d.includes('ba '));

		let score = 70; // Base score
		let relevance = 'Education meets general requirements';

		if (requiresPhd) {
			score = hasPhd ? 100 : hasMaster ? 60 : 40;
			relevance = hasPhd ? 'PhD requirement met' : 'PhD preferred but not held';
		} else if (requiresMaster) {
			score = hasMaster || hasPhd ? 100 : hasBachelor ? 70 : 50;
			relevance = hasMaster || hasPhd ? 'Master\'s requirement met' : 'Master\'s preferred';
		} else if (requiresBachelor) {
			score = hasBachelor || hasMaster || hasPhd ? 100 : 60;
			relevance = hasBachelor || hasMaster || hasPhd ? 'Bachelor\'s requirement met' : 'Degree preferred';
		}

		// Bonus for relevant field
		const relevantFields = ['computer science', 'software', 'engineering', 'mathematics', 'physics', 'data science'];
		const hasRelevantField = profile.education.some((e) =>
			relevantFields.some((f) => e.field?.toLowerCase().includes(f) || e.degree.toLowerCase().includes(f))
		);

		if (hasRelevantField) {
			score = Math.min(100, score + 10);
			relevance += ' (relevant field)';
		}

		return { score, relevance };
	}

	private calculateLocationScore(
		job: JobMatchAgentInput['job'],
		profile: JobMatchAgentInput['profile']
	): { score: number; compatible: boolean } {
		// If job is remote, location is always compatible
		if (job.isRemote) {
			return { score: 100, compatible: true };
		}

		// If no location requirements, assume compatible
		if (!job.location) {
			return { score: 90, compatible: true };
		}

		// If candidate has no location, assume they're flexible
		if (!profile.location) {
			return { score: 80, compatible: true };
		}

		// Simple location matching
		const jobLocation = job.location.toLowerCase();
		const profileLocation = profile.location.toLowerCase();

		// Extract city and state/country
		const jobParts = jobLocation.split(/[,\s]+/);
		const profileParts = profileLocation.split(/[,\s]+/);

		// Check for any matching parts
		const hasMatch = jobParts.some((jp) =>
			profileParts.some((pp) => jp === pp || jp.includes(pp) || pp.includes(jp))
		);

		if (hasMatch) {
			return { score: 100, compatible: true };
		}

		// Check for same country/region
		const sameCountry =
			(jobLocation.includes('usa') || jobLocation.includes('united states')) &&
			(profileLocation.includes('usa') || profileLocation.includes('united states'));

		if (sameCountry) {
			return { score: 70, compatible: true };
		}

		return { score: 40, compatible: false };
	}

	private calculateSalaryScore(
		job: JobMatchAgentInput['job'],
		profile: JobMatchAgentInput['profile']
	): { score: number; inRange: boolean } {
		// If job has no salary info, neutral score (unknown compatibility)
		if (!job.salaryMin && !job.salaryMax) {
			return { score: 70, inRange: true };
		}

		// If profile has no salary expectations, assume compatible
		if (!profile.minSalary && !profile.maxSalary) {
			return { score: 75, inRange: true };
		}

		const jobMin = job.salaryMin || 0;
		const jobMax = job.salaryMax || Infinity;
		const profileMin = profile.minSalary || 0;
		const profileMax = profile.maxSalary || Infinity;

		// Perfect match: job range fully contains profile expectations
		if (jobMin <= profileMin && jobMax >= profileMax) {
			return { score: 100, inRange: true };
		}

		// Good match: significant overlap between ranges
		const overlapMin = Math.max(jobMin, profileMin);
		const overlapMax = Math.min(jobMax, profileMax);

		if (overlapMin <= overlapMax) {
			// Calculate overlap percentage
			const profileRange = (profile.maxSalary || profileMin) - profileMin;
			const overlapRange = overlapMax - overlapMin;

			if (profileRange > 0) {
				const overlapPercent = (overlapRange / profileRange) * 100;
				// Score based on overlap: 50% overlap = 75 score, 100% overlap = 100 score
				const score = Math.round(50 + overlapPercent * 0.5);
				return { score: Math.min(score, 100), inRange: true };
			}

			// Profile has single salary expectation that falls in job range
			return { score: 90, inRange: true };
		}

		// No overlap - job pays less than minimum expectation
		if (jobMax < profileMin) {
			// Calculate how far off: closer = higher score
			const gap = profileMin - jobMax;
			const gapPercent = gap / profileMin;
			// 10% gap = 50 score, 50% gap = 20 score
			const score = Math.max(20, Math.round(60 - gapPercent * 100));
			return { score, inRange: false };
		}

		// Job pays more than expected (rare concern, still a match)
		return { score: 85, inRange: true };
	}

	private async generateInsights(
		input: JobMatchAgentInput,
		scores: {
			overall: number;
			skills: { score: number; matched: string[]; missing: string[] };
			experience: { score: number; relevance: string };
			education: { score: number; relevance: string };
			location: { score: number; compatible: boolean };
			salary: { score: number; inRange: boolean };
		},
		context: AgentContext
	): Promise<{ reasons: string[]; suggestions: string[]; concerns: string[] }> {
		const prompt = `Analyze this job match and provide insights.

JOB: ${input.job.title} at ${input.job.company}
CANDIDATE: ${input.profile.fullName} - ${input.profile.headline}

SCORES:
- Overall: ${scores.overall}%
- Skills: ${scores.skills.score}% (matched: ${scores.skills.matched.join(', ')}, missing: ${scores.skills.missing.join(', ')})
- Experience: ${scores.experience.score}% - ${scores.experience.relevance}
- Education: ${scores.education.score}% - ${scores.education.relevance}
- Location: ${scores.location.score}% - ${scores.location.compatible ? 'Compatible' : 'May require relocation'}

Return JSON with:
{
  "reasons": ["3-5 key reasons why this is a good/poor match"],
  "suggestions": ["2-3 actionable suggestions to improve candidacy"],
  "concerns": ["1-3 potential concerns or red flags, if any"]
}`;

		try {
			const result = await this.generate(
				{
					model: 'gemini-1.5-flash',
					userPrompt: prompt,
					maxTokens: 500,
					temperature: 0.3
				},
				context
			);

			const jsonMatch = result.content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				return JSON.parse(jsonMatch[0]);
			}
		} catch (error) {
			console.error('Failed to generate match insights:', error);
		}

		// Fallback insights based on scores
		return {
			reasons: [
				scores.overall >= 70 ? 'Strong overall match' : 'Moderate match with room for improvement',
				scores.skills.matched.length > 0 ? `Matches ${scores.skills.matched.length} key skills` : 'Limited skill overlap',
				scores.experience.relevance
			],
			suggestions:
				scores.skills.missing.length > 0
					? [`Consider highlighting or developing: ${scores.skills.missing.slice(0, 3).join(', ')}`]
					: [],
			concerns:
				scores.overall < 60
					? ['Below typical match threshold - consider if this role aligns with your background']
					: []
		};
	}
}

// Export singleton instance
export const jobMatchAgent = new JobMatchAgent();
