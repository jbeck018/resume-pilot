// =============================================================================
// MCP Integration Module
// =============================================================================
// Exports for claude-flow MCP integration including:
// - Client management and connection pooling
// - Memory bridge for pattern learning
// - Swarm coordinator for parallel operations

// Client
export {
	getMCPClient,
	releaseMCPClient,
	callMCPTool,
	listMCPTools,
	shutdownMCPClients,
	isMCPEnabled,
	getMCPStatus,
	type MCPClientConfig,
	type MCPClientInstance
} from './client';

// Memory Bridge
export {
	storePattern,
	findSimilarPatterns,
	getPatternsByType,
	storeAgentExecution,
	getAgentStats,
	learnFromSuccess,
	learnFromFailure,
	getGenerationRecommendations,
	type GenerationPattern,
	type AgentExecutionRecord,
	type SimilarPattern
} from './memory-bridge';

// Swarm Coordinator
export {
	initializeSwarm,
	getSwarmStatus,
	shutdownSwarm,
	coordinateBatchMatching,
	runConsensusQualityCheck,
	spawnSpecializedAgents,
	terminateAgents,
	broadcastToAgents,
	storeInHiveMemory,
	retrieveFromHiveMemory,
	type SwarmConfig,
	type SwarmStatus,
	type BatchMatchResult,
	type ConsensusResult
} from './swarm-coordinator';
