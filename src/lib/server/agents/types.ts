// =============================================================================
// Agent System Types
// =============================================================================

import type { Langfuse, LangfuseTraceClient, LangfuseSpanClient } from 'langfuse';

// -----------------------------------------------------------------------------
// Core Agent Types
// -----------------------------------------------------------------------------

/**
 * Agent execution state machine states
 */
export type AgentState = 'idle' | 'planning' | 'executing' | 'validating' | 'completed' | 'failed';

/**
 * Agent execution priority levels
 */
export type AgentPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Base agent configuration
 */
export interface AgentConfig {
	/** Unique agent identifier */
	id: string;
	/** Human-readable agent name */
	name: string;
	/** Agent description */
	description: string;
	/** Default model to use */
	defaultModel: ModelId;
	/** Maximum retries on failure */
	maxRetries: number;
	/** Timeout in milliseconds */
	timeoutMs: number;
	/** Execution priority */
	priority: AgentPriority;
}

/**
 * Agent execution context passed to all operations
 */
export interface AgentContext {
	/** User ID for budget/permissions */
	userId: string;
	/** Job ID if applicable */
	jobId?: string;
	/** Application ID if applicable */
	applicationId?: string;
	/** Langfuse trace for observability */
	trace: LangfuseTraceClient;
	/** Parent span for nested operations */
	parentSpan?: LangfuseSpanClient;
	/** Abort signal for cancellation */
	abortSignal?: AbortSignal;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Agent execution result
 */
export interface AgentResult<T = unknown> {
	/** Whether execution succeeded */
	success: boolean;
	/** Result data if successful */
	data?: T;
	/** Error message if failed */
	error?: string;
	/** Error code for categorization */
	errorCode?: AgentErrorCode;
	/** Execution duration in ms */
	durationMs: number;
	/** Total cost in cents */
	costCents: number;
	/** Token usage breakdown */
	usage: TokenUsage;
	/** Langfuse trace ID */
	traceId: string;
}

/**
 * Error codes for agent failures
 */
export type AgentErrorCode =
	| 'BUDGET_EXCEEDED'
	| 'RATE_LIMITED'
	| 'API_ERROR'
	| 'VALIDATION_FAILED'
	| 'TIMEOUT'
	| 'CANCELLED'
	| 'INVALID_INPUT'
	| 'TOOL_FAILED'
	| 'UNKNOWN';

// -----------------------------------------------------------------------------
// Tool Types
// -----------------------------------------------------------------------------

/**
 * Tool definition for agent capabilities
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
	/** Unique tool identifier */
	id: string;
	/** Tool name for display */
	name: string;
	/** Tool description for agent reasoning */
	description: string;
	/** Input schema (Zod schema as JSON) */
	inputSchema: Record<string, unknown>;
	/** Execute the tool */
	execute: (input: TInput, context: ToolContext) => Promise<ToolResult<TOutput>>;
}

/**
 * Tool execution context
 */
export interface ToolContext {
	/** User ID */
	userId: string;
	/** Langfuse span for tracing */
	span: LangfuseSpanClient;
	/** Abort signal */
	abortSignal?: AbortSignal;
}

/**
 * Tool execution result
 */
export interface ToolResult<T = unknown> {
	/** Whether tool succeeded */
	success: boolean;
	/** Result data */
	data?: T;
	/** Error if failed */
	error?: string;
	/** Whether result was cached */
	cached?: boolean;
	/** Execution time ms */
	durationMs: number;
}

// -----------------------------------------------------------------------------
// LLM Types
// -----------------------------------------------------------------------------

/**
 * Available model identifiers
 */
export type ModelId =
	| 'claude-3-5-sonnet-20241022'
	| 'claude-3-haiku-20240307'
	| 'gpt-4o'
	| 'gpt-4o-mini'
	| 'gemini-1.5-pro'
	| 'gemini-1.5-flash';

/**
 * Token usage breakdown
 */
export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

/**
 * LLM generation options
 */
export interface GenerationOptions {
	/** Model to use */
	model: ModelId;
	/** System prompt */
	systemPrompt?: string;
	/** User prompt */
	userPrompt: string;
	/** Maximum tokens to generate */
	maxTokens?: number;
	/** Temperature (0-1) */
	temperature?: number;
	/** Stop sequences */
	stopSequences?: string[];
	/** JSON mode */
	jsonMode?: boolean;
}

/**
 * LLM generation result
 */
export interface GenerationResult {
	/** Generated content */
	content: string;
	/** Parsed JSON if jsonMode was true */
	json?: unknown;
	/** Model used */
	model: ModelId;
	/** Token usage */
	usage: TokenUsage;
	/** Cost in cents */
	costCents: number;
	/** Finish reason */
	finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

// -----------------------------------------------------------------------------
// Domain Types
// -----------------------------------------------------------------------------

/**
 * Job information for agent processing
 */
export interface JobInfo {
	id: string;
	title: string;
	company: string;
	description: string;
	requirements?: string[];
	benefits?: string[];
	location?: string;
	isRemote?: boolean;
	salaryMin?: number;
	salaryMax?: number;
	experienceLevel?: string;
	employmentType?: string;
	sourceUrl: string;
}

/**
 * Profile information for agent processing
 */
export interface ProfileInfo {
	id: string;
	fullName: string;
	email?: string;
	headline?: string;
	summary?: string;
	location?: string;
	skills: string[];
	experience: ExperienceItem[];
	education: EducationItem[];
	linkedinUrl?: string;
	githubHandle?: string;
	/** Minimum acceptable salary (optional) */
	minSalary?: number;
	/** Maximum expected salary (optional) */
	maxSalary?: number;
}

/**
 * Experience item
 */
export interface ExperienceItem {
	title: string;
	company: string;
	location?: string;
	startDate: string;
	endDate?: string;
	current: boolean;
	description?: string;
	skills?: string[];
}

/**
 * Education item
 */
export interface EducationItem {
	institution: string;
	degree: string;
	field?: string;
	startDate?: string;
	endDate?: string;
	gpa?: string;
}

/**
 * Resume information
 */
export interface ResumeInfo {
	id: string;
	name: string;
	parsedContent?: string;
	structuredData?: ResumeStructuredData;
}

/**
 * Structured resume data
 */
export interface ResumeStructuredData {
	name?: string;
	email?: string;
	phone?: string;
	summary?: string;
	skills?: string[];
	experience?: ExperienceItem[];
	education?: EducationItem[];
	certifications?: string[];
	projects?: Array<{ name: string; description: string; url?: string }>;
}

// -----------------------------------------------------------------------------
// Agent-Specific Types
// -----------------------------------------------------------------------------

/**
 * Resume Agent input
 */
export interface ResumeAgentInput {
	job: JobInfo;
	profile: ProfileInfo;
	resume?: ResumeInfo;
	options?: {
		includeResearch?: boolean;
		focusAreas?: string[];
		maxLength?: 'one_page' | 'two_page';
	};
}

/**
 * Resume Agent output
 */
export interface ResumeAgentOutput {
	/** Generated tailored resume (markdown) */
	resume: string;
	/** Key highlights emphasized */
	highlights: string[];
	/** Skills matched to job requirements */
	matchedSkills: string[];
	/** Gaps identified */
	gaps: string[];
	/** ATS optimization score (0-100) */
	atsScore: number;
	/** Company research if included */
	companyResearch?: CompanyResearch;
}

/**
 * Cover Letter Agent input
 */
export interface CoverLetterAgentInput {
	job: JobInfo;
	profile: ProfileInfo;
	resume?: ResumeInfo;
	options?: {
		includeResearch?: boolean;
		tone?: 'formal' | 'conversational' | 'enthusiastic';
		focusPoints?: string[];
	};
}

/**
 * Cover Letter Agent output
 */
export interface CoverLetterAgentOutput {
	/** Generated cover letter */
	coverLetter: string;
	/** Key points addressed */
	keyPoints: string[];
	/** Company-specific customizations made */
	customizations: string[];
	/** Quality score (0-100) */
	qualityScore: number;
}

/**
 * Job Match Agent input
 */
export interface JobMatchAgentInput {
	job: JobInfo;
	profile: ProfileInfo;
	options?: {
		weights?: {
			skills?: number;
			experience?: number;
			education?: number;
			location?: number;
			salary?: number;
		};
	};
}

/**
 * Job Match Agent output
 */
export interface JobMatchAgentOutput {
	/** Overall match score (0-100) */
	overallScore: number;
	/** Score breakdown by category */
	breakdown: {
		skills: { score: number; matched: string[]; missing: string[] };
		experience: { score: number; relevance: string };
		education: { score: number; relevance: string };
		location: { score: number; compatible: boolean };
		salary: { score: number; inRange: boolean };
	};
	/** Reasons for the match */
	matchReasons: string[];
	/** Improvement suggestions */
	suggestions: string[];
	/** Red flags or concerns */
	concerns: string[];
}

/**
 * Profile Agent input
 */
export interface ProfileAgentInput {
	profile: ProfileInfo;
	resume?: ResumeInfo;
	targetRoles?: string[];
}

/**
 * Profile Agent output
 */
export interface ProfileAgentOutput {
	/** Enhanced profile summary */
	enhancedSummary: string;
	/** Suggested headline improvements */
	headlineSuggestions: string[];
	/** Skills to add based on experience */
	suggestedSkills: string[];
	/** Experience improvements */
	experienceEnhancements: Array<{
		original: string;
		enhanced: string;
		reason: string;
	}>;
	/** Overall profile strength (0-100) */
	profileStrength: number;
	/** Specific recommendations */
	recommendations: string[];
}

/**
 * Company research data
 */
export interface CompanyResearch {
	/** Company name */
	name: string;
	/** Company description */
	description?: string;
	/** Industry */
	industry?: string;
	/** Company size */
	size?: string;
	/** Company culture notes */
	culture?: string[];
	/** Recent news/updates */
	recentNews?: string[];
	/** Key technologies used */
	technologies?: string[];
	/** Company values */
	values?: string[];
	/** Research timestamp */
	researchedAt: Date;
}

// -----------------------------------------------------------------------------
// Skill Extraction Types
// -----------------------------------------------------------------------------

/**
 * Extracted skill with metadata
 */
export interface ExtractedSkill {
	/** Skill name (normalized) */
	name: string;
	/** Skill category */
	category: SkillCategory;
	/** Importance level in context */
	importance: 'required' | 'preferred' | 'nice_to_have';
	/** Years of experience if mentioned */
	yearsRequired?: number;
	/** Original text snippet */
	sourceText?: string;
}

/**
 * Skill categories
 */
export type SkillCategory =
	| 'programming_language'
	| 'framework'
	| 'database'
	| 'cloud'
	| 'devops'
	| 'soft_skill'
	| 'methodology'
	| 'tool'
	| 'domain'
	| 'certification'
	| 'other';

// -----------------------------------------------------------------------------
// Quality Scoring Types
// -----------------------------------------------------------------------------

/**
 * Quality score result
 */
export interface QualityScore {
	/** Overall score (0-100) */
	overall: number;
	/** ATS compatibility score */
	atsCompatibility: number;
	/** Keyword coverage score */
	keywordCoverage: number;
	/** Format quality score */
	formatQuality: number;
	/** Content relevance score */
	contentRelevance: number;
	/** Specific issues found */
	issues: QualityIssue[];
	/** Improvement suggestions */
	suggestions: string[];
}

/**
 * Quality issue
 */
export interface QualityIssue {
	/** Issue type */
	type: 'error' | 'warning' | 'info';
	/** Issue category */
	category: 'ats' | 'content' | 'format' | 'keyword';
	/** Issue message */
	message: string;
	/** Location in document */
	location?: string;
}

// -----------------------------------------------------------------------------
// Orchestration Types
// -----------------------------------------------------------------------------

/**
 * Orchestration step definition
 */
export interface OrchestrationStep {
	/** Step ID */
	id: string;
	/** Step name */
	name: string;
	/** Agent to execute */
	agentId: string;
	/** Input mapping from previous steps */
	inputMapping: Record<string, string>;
	/** Dependencies (step IDs that must complete first) */
	dependsOn?: string[];
	/** Whether step is optional */
	optional?: boolean;
	/** Condition for execution */
	condition?: (context: Record<string, unknown>) => boolean;
}

/**
 * Orchestration plan
 */
export interface OrchestrationPlan {
	/** Plan ID */
	id: string;
	/** Plan name */
	name: string;
	/** Steps to execute */
	steps: OrchestrationStep[];
	/** Initial input */
	input: Record<string, unknown>;
	/** Timeout for entire plan */
	timeoutMs: number;
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
	/** Plan ID */
	planId: string;
	/** Whether all required steps succeeded */
	success: boolean;
	/** Results by step ID */
	stepResults: Record<string, AgentResult>;
	/** Total duration ms */
	totalDurationMs: number;
	/** Total cost cents */
	totalCostCents: number;
	/** Trace ID */
	traceId: string;
}

// -----------------------------------------------------------------------------
// Event Types (for Inngest)
// -----------------------------------------------------------------------------

/**
 * Application generation requested event
 */
export interface ApplicationGenerateEvent {
	name: 'application/generate.requested';
	data: {
		userId: string;
		jobId: string;
		applicationId: string;
		options?: {
			includeResearch?: boolean;
			generateCoverLetter?: boolean;
			targetFormat?: 'markdown' | 'pdf';
		};
	};
}

/**
 * Job matching requested event
 */
export interface JobMatchEvent {
	name: 'job/match.requested';
	data: {
		userId: string;
		jobId: string;
		profileId: string;
	};
}

/**
 * Profile analysis requested event
 */
export interface ProfileAnalyzeEvent {
	name: 'profile/analyze.requested';
	data: {
		userId: string;
		profileId: string;
		targetRoles?: string[];
	};
}

/**
 * All agent events
 */
export type AgentEvent = ApplicationGenerateEvent | JobMatchEvent | ProfileAnalyzeEvent;
