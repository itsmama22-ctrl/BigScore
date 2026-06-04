/**
 * Backward-compatibility re-exports.
 *
 * Existing code imports { getProvider, LiveScoreProvider, ExternalMatch, MockLiveScoreProvider }
 * from this module. This file bridges to the new SportsAPIManager architecture.
 *
 * For new code, import directly from "@/lib/services/providers" or use SportsAPIManager.
 */

// Re-export the old interface (now SportsApiProvider) under the old name
export type { SportsApiProvider as LiveScoreProvider } from "./providers/base";
export type { ExternalMatch } from "./providers/base";

// Re-export mock provider
export { MockSportsApiProvider as MockLiveScoreProvider } from "./providers/mockProvider";

// Factory — routes to the new provider system
export { createProvider as getProvider } from "./providers/index";

// Also export for new consumers
export { SportsAPIManager } from "./sportsApiManager";
export { createProvider, availableProviders } from "./providers/index";
