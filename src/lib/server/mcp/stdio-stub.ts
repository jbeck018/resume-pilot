// =============================================================================
// MCP Stdio Stub for Cloudflare Workers
// =============================================================================
// This stub replaces ai/mcp-stdio in production builds because stdio transport
// requires child_process which is not available in Cloudflare Workers.
// The actual MCP stdio transport only works in Node.js environments (local dev).

export class Experimental_StdioMCPTransport {
	constructor(_options: { command: string; args?: string[] }) {
		throw new Error(
			'MCP stdio transport is not available in Cloudflare Workers. ' +
			'Use HTTP transport instead or run locally with Node.js.'
		);
	}
}

export default { Experimental_StdioMCPTransport };
