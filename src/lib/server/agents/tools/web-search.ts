// =============================================================================
// Web Search Tool
// =============================================================================

import type { ToolDefinition, ToolContext, ToolResult, CompanyResearch } from '../types';
import { complete } from '../../llm/client';

export interface WebSearchInput {
	query: string;
	type: 'company' | 'industry' | 'general';
	companyName?: string;
	maxResults?: number;
}

export interface WebSearchOutput {
	results: SearchResult[];
	summary?: string;
	companyResearch?: CompanyResearch;
	isPlaceholder?: boolean; // True when real search APIs are unavailable
}

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	source: string;
}

/**
 * Web Search Tool for company research and general information gathering
 *
 * Supported APIs:
 * - Perplexity API (PERPLEXITY_API_KEY) - Recommended for quality
 * - Tavily API (TAVILY_API_KEY) - Good for structured company data
 * - Development fallback when no API keys are configured
 */
export const WebSearchTool: ToolDefinition<WebSearchInput, WebSearchOutput> = {
	id: 'web-search',
	name: 'Web Search',
	description:
		'Search the web for information about companies, industries, or general topics. ' +
		'Useful for researching company culture, recent news, and industry trends.',
	inputSchema: {
		type: 'object',
		properties: {
			query: { type: 'string', description: 'Search query' },
			type: {
				type: 'string',
				enum: ['company', 'industry', 'general'],
				description: 'Type of search'
			},
			companyName: { type: 'string', description: 'Company name for company research' },
			maxResults: { type: 'number', description: 'Maximum results to return', default: 5 }
		},
		required: ['query', 'type']
	},

	async execute(input: WebSearchInput, context: ToolContext): Promise<ToolResult<WebSearchOutput>> {
		const startTime = Date.now();

		try {
			// Check for abort signal
			if (context.abortSignal?.aborted) {
				return {
					success: false,
					error: 'Search cancelled',
					durationMs: Date.now() - startTime
				};
			}

			// Perform search using available API providers
			const { results: searchResults, isPlaceholder } = await performSearch(input);

			// If company research, synthesize into structured format
			// Skip synthesis for placeholder data to avoid generating fake insights
			let companyResearch: CompanyResearch | undefined;
			if (input.type === 'company' && input.companyName && !isPlaceholder) {
				companyResearch = await synthesizeCompanyResearch(input.companyName, searchResults, context);
			}

			// Generate summary (or placeholder message)
			const summary = isPlaceholder
				? `Note: Web search is unavailable (no API keys configured). Results shown are illustrative only.`
				: await generateSearchSummary(searchResults, input, context);

			return {
				success: true,
				data: {
					results: searchResults,
					summary,
					companyResearch,
					isPlaceholder
				},
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Search failed',
				durationMs: Date.now() - startTime
			};
		}
	}
};

interface SearchResponse {
	results: SearchResult[];
	isPlaceholder: boolean;
}

/**
 * Perform the actual search using available API providers
 * Supports: Perplexity API, Tavily API, with development fallback
 */
async function performSearch(input: WebSearchInput): Promise<SearchResponse> {
	// Check if Perplexity API is configured
	const perplexityKey = process.env.PERPLEXITY_API_KEY;

	if (perplexityKey) {
		return { results: await searchWithPerplexity(input, perplexityKey), isPlaceholder: false };
	}

	// Check if Tavily API is configured
	const tavilyKey = process.env.TAVILY_API_KEY;

	if (tavilyKey) {
		return { results: await searchWithTavily(input, tavilyKey), isPlaceholder: false };
	}

	// In production, log a warning - search APIs should be configured
	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction) {
		console.warn(
			'[WebSearch] WARNING: No search API keys configured (PERPLEXITY_API_KEY or TAVILY_API_KEY). ' +
				'Returning placeholder data. Configure API keys for real search results.'
		);
	}

	// Fallback: Return placeholder results
	// These are clearly marked as placeholders and should only be used for development/testing
	return { results: getPlaceholderResults(input), isPlaceholder: true };
}

/**
 * Search using Perplexity API
 */
async function searchWithPerplexity(input: WebSearchInput, apiKey: string): Promise<SearchResult[]> {
	const response = await fetch('https://api.perplexity.ai/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: 'llama-3.1-sonar-small-128k-online',
			messages: [
				{
					role: 'system',
					content:
						'You are a research assistant. Search for information and return structured results with sources.'
				},
				{
					role: 'user',
					content: input.query
				}
			],
			max_tokens: 1024,
			return_citations: true
		})
	});

	if (!response.ok) {
		throw new Error(`Perplexity API error: ${response.statusText}`);
	}

	const data = await response.json();

	// Parse citations into search results
	const citations = data.citations || [];
	return citations.slice(0, input.maxResults || 5).map((citation: { url: string; title?: string }) => ({
		title: citation.title || 'Search Result',
		url: citation.url,
		snippet: data.choices?.[0]?.message?.content?.slice(0, 200) || '',
		source: new URL(citation.url).hostname
	}));
}

/**
 * Search using Tavily API
 */
async function searchWithTavily(input: WebSearchInput, apiKey: string): Promise<SearchResult[]> {
	const response = await fetch('https://api.tavily.com/search', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			api_key: apiKey,
			query: input.query,
			search_depth: input.type === 'company' ? 'advanced' : 'basic',
			include_domains:
				input.type === 'company'
					? ['linkedin.com', 'glassdoor.com', 'crunchbase.com', 'techcrunch.com']
					: undefined,
			max_results: input.maxResults || 5
		})
	});

	if (!response.ok) {
		throw new Error(`Tavily API error: ${response.statusText}`);
	}

	const data = await response.json();

	return (data.results || []).map((result: { title: string; url: string; content: string }) => ({
		title: result.title,
		url: result.url,
		snippet: result.content?.slice(0, 300) || '',
		source: new URL(result.url).hostname
	}));
}

/**
 * Placeholder results for development/testing when no API keys are configured
 * These results are clearly marked and should NOT be used for actual company research
 */
function getPlaceholderResults(input: WebSearchInput): SearchResult[] {
	if (input.type === 'company' && input.companyName) {
		return [
			{
				title: `[Placeholder] ${input.companyName} - Company Overview`,
				url: `#placeholder-${input.companyName.toLowerCase().replace(/\s/g, '-')}`,
				snippet: `This is placeholder data. Configure PERPLEXITY_API_KEY or TAVILY_API_KEY for real company research about ${input.companyName}.`,
				source: 'placeholder'
			}
		];
	}

	return [
		{
			title: `[Placeholder] Search result for: ${input.query}`,
			url: `#placeholder-search`,
			snippet: `This is placeholder data. Configure PERPLEXITY_API_KEY or TAVILY_API_KEY for real search results.`,
			source: 'placeholder'
		}
	];
}

/**
 * Synthesize company research from search results
 */
async function synthesizeCompanyResearch(
	companyName: string,
	results: SearchResult[],
	context: ToolContext
): Promise<CompanyResearch> {
	const prompt = `Based on the following search results about ${companyName}, extract structured company information:

Search Results:
${results.map((r) => `- ${r.title}: ${r.snippet}`).join('\n')}

Extract:
1. Brief company description
2. Industry
3. Company size (if mentioned)
4. Culture notes
5. Key technologies used
6. Company values

Return as JSON:
{
  "description": "...",
  "industry": "...",
  "size": "...",
  "culture": ["..."],
  "technologies": ["..."],
  "values": ["..."]
}`;

	try {
		const result = await complete({
			model: 'gemini-1.5-flash',
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 500,
			temperature: 0.3,
			userId: context.userId,
			metadata: { purpose: 'company-research' }
		});

		// Parse JSON from response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			return {
				name: companyName,
				description: parsed.description,
				industry: parsed.industry,
				size: parsed.size,
				culture: parsed.culture || [],
				technologies: parsed.technologies || [],
				values: parsed.values || [],
				researchedAt: new Date()
			};
		}
	} catch (error) {
		console.error('Failed to synthesize company research:', error);
	}

	// Return basic structure if synthesis fails
	return {
		name: companyName,
		researchedAt: new Date()
	};
}

/**
 * Generate a summary of search results
 */
async function generateSearchSummary(
	results: SearchResult[],
	input: WebSearchInput,
	context: ToolContext
): Promise<string> {
	if (results.length === 0) {
		return 'No search results found.';
	}

	const prompt = `Summarize the following search results for the query "${input.query}" in 2-3 sentences:

${results.map((r) => `- ${r.title}: ${r.snippet}`).join('\n')}`;

	try {
		const result = await complete({
			model: 'gemini-1.5-flash',
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 200,
			temperature: 0.3,
			userId: context.userId,
			metadata: { purpose: 'search-summary' }
		});

		return result.content;
	} catch {
		return `Found ${results.length} results for "${input.query}".`;
	}
}
