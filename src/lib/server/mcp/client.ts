// =============================================================================
// MCP Client for Claude-Flow Integration
// =============================================================================
// Provides a wrapper around the MCP SDK for connecting to claude-flow MCP server.
// Supports both stdio and HTTP transports with connection pooling.

import { experimental_createMCPClient as createMCPClient, type MCPTransport } from 'ai';

// Note: StdioMCPTransport is dynamically imported only when needed to avoid
// bundling child_process which doesn't work in Cloudflare Workers

// Environment configuration
const CLAUDE_FLOW_MCP_URL = process.env.CLAUDE_FLOW_MCP_URL || 'http://localhost:3001';
const CLAUDE_FLOW_ENABLED = process.env.CLAUDE_FLOW_ENABLED === 'true';
const CLAUDE_FLOW_TRANSPORT = process.env.CLAUDE_FLOW_TRANSPORT || 'stdio'; // 'stdio' | 'http'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MCPClientConfig {
	/** Transport type: 'stdio' or 'http' */
	transport: 'stdio' | 'http';
	/** HTTP URL for http transport */
	url?: string;
	/** Command for stdio transport */
	command?: string;
	/** Arguments for stdio transport */
	args?: string[];
	/** Connection timeout in ms */
	timeoutMs?: number;
}

export interface MCPClientInstance {
	/** The underlying MCP client */
	client: Awaited<ReturnType<typeof createMCPClient>>;
	/** Close the connection */
	close: () => Promise<void>;
	/** Check if connected */
	isConnected: () => boolean;
}

// -----------------------------------------------------------------------------
// Connection Pool
// -----------------------------------------------------------------------------

const connectionPool: Map<string, MCPClientInstance> = new Map();
const MAX_POOL_SIZE = 5;
const CONNECTION_TTL_MS = 300000; // 5 minutes

interface PooledConnection {
	instance: MCPClientInstance;
	lastUsed: number;
	inUse: boolean;
}

const pooledConnections: Map<string, PooledConnection> = new Map();

// Cleanup stale connections periodically
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval(): void {
	if (cleanupInterval) return;

	cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [key, conn] of pooledConnections.entries()) {
			if (!conn.inUse && now - conn.lastUsed > CONNECTION_TTL_MS) {
				conn.instance.close().catch(() => {
			// Connection cleanup error - non-critical
		});
				pooledConnections.delete(key);
			}
		}
	}, 60000); // Run every minute
}

// -----------------------------------------------------------------------------
// Client Factory
// -----------------------------------------------------------------------------

/**
 * Create or retrieve a pooled MCP client connection
 */
export async function getMCPClient(
	config?: Partial<MCPClientConfig>
): Promise<MCPClientInstance | null> {
	if (!CLAUDE_FLOW_ENABLED) {
		return null;
	}

	const effectiveConfig: MCPClientConfig = {
		transport: (config?.transport || CLAUDE_FLOW_TRANSPORT) as 'stdio' | 'http',
		url: config?.url || CLAUDE_FLOW_MCP_URL,
		command: config?.command || 'npx',
		args: config?.args || ['@claude-flow/cli@latest', 'mcp', 'start', '--port', '3001'],
		timeoutMs: config?.timeoutMs || 30000
	};

	const poolKey = effectiveConfig.transport === 'http'
		? `http:${effectiveConfig.url}`
		: `stdio:${effectiveConfig.command}:${effectiveConfig.args?.join(',')}`;

	// Check for existing pooled connection
	const pooled = pooledConnections.get(poolKey);
	if (pooled && !pooled.inUse && pooled.instance.isConnected()) {
		pooled.inUse = true;
		pooled.lastUsed = Date.now();
		return pooled.instance;
	}

	// Create new connection
	try {
		const instance = await createMCPClientInstance(effectiveConfig);

		// Add to pool if under limit
		if (pooledConnections.size < MAX_POOL_SIZE) {
			pooledConnections.set(poolKey, {
				instance,
				lastUsed: Date.now(),
				inUse: true
			});
			startCleanupInterval();
		}

		return instance;
	} catch (error) {
		console.error('[MCP] Failed to create client:', error);
		return null;
	}
}

/**
 * Release a pooled connection back to the pool
 */
export function releaseMCPClient(client: MCPClientInstance): void {
	for (const [key, conn] of pooledConnections.entries()) {
		if (conn.instance === client) {
			conn.inUse = false;
			conn.lastUsed = Date.now();
			return;
		}
	}
}

/**
 * Create a new MCP client instance
 */
async function createMCPClientInstance(config: MCPClientConfig): Promise<MCPClientInstance> {
	let transport: MCPTransport;
	let connected = true;

	if (config.transport === 'stdio') {
		// Dynamic import to avoid bundling child_process in Cloudflare Workers
		// This will only be executed in Node.js environments
		try {
			const { Experimental_StdioMCPTransport: StdioMCPTransport } = await import('ai/mcp-stdio');
			transport = new StdioMCPTransport({
				command: config.command!,
				args: config.args
			});
		} catch (error) {
			console.error('[MCP] stdio transport not available in this environment:', error);
			throw new Error('stdio transport is not supported in this environment (requires Node.js)');
		}
	} else {
		// HTTP transport using SSE
		const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
		transport = new SSEClientTransport(new URL(config.url!));
	}

	const client = await createMCPClient({ transport });

	return {
		client,
		close: async () => {
			connected = false;
			await client.close();
		},
		isConnected: () => connected
	};
}

// -----------------------------------------------------------------------------
// High-Level MCP Operations
// -----------------------------------------------------------------------------

/**
 * Call an MCP tool on the claude-flow server
 */
export async function callMCPTool<TInput extends Record<string, unknown>, TOutput>(
	toolName: string,
	input: TInput
): Promise<TOutput | null> {
	const clientInstance = await getMCPClient();
	if (!clientInstance) {
		return null;
	}

	try {
		const tools = await clientInstance.client.tools();

		// Find the tool by key (tool name is the key in the record)
		const tool = tools[toolName];
		if (!tool) {
			// Tool not found in MCP
			return null;
		}

		// Execute the tool with arguments
		// Note: The tool.execute expects different options - we need to pass tool execution options
		const result = await tool.execute(input, {
			toolCallId: `call_${Date.now()}`,
			messages: []
		});
		return result as TOutput;
	} catch (error) {
		console.error(`[MCP] Tool execution failed: ${toolName}`, error);
		return null;
	} finally {
		releaseMCPClient(clientInstance);
	}
}

/**
 * List available MCP tools
 */
export async function listMCPTools(): Promise<string[]> {
	const clientInstance = await getMCPClient();
	if (!clientInstance) {
		return [];
	}

	try {
		const tools = await clientInstance.client.tools();
		return Object.keys(tools);
	} catch (error) {
		console.error('[MCP] Failed to list tools:', error);
		return [];
	} finally {
		releaseMCPClient(clientInstance);
	}
}

// -----------------------------------------------------------------------------
// Shutdown
// -----------------------------------------------------------------------------

/**
 * Close all pooled connections
 */
export async function shutdownMCPClients(): Promise<void> {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	}

	const closePromises: Promise<void>[] = [];
	for (const conn of pooledConnections.values()) {
		closePromises.push(conn.instance.close());
	}

	await Promise.allSettled(closePromises);
	pooledConnections.clear();
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Check if MCP integration is enabled and available
 */
export function isMCPEnabled(): boolean {
	return CLAUDE_FLOW_ENABLED;
}

/**
 * Get MCP configuration status
 */
export function getMCPStatus(): {
	enabled: boolean;
	transport: string;
	url: string;
	poolSize: number;
} {
	return {
		enabled: CLAUDE_FLOW_ENABLED,
		transport: CLAUDE_FLOW_TRANSPORT,
		url: CLAUDE_FLOW_MCP_URL,
		poolSize: pooledConnections.size
	};
}
