import type { SportsApiProvider, SportsApiProviderConfig } from "./base";
import { MockSportsApiProvider } from "./mockProvider";
import { ApiFootballProvider } from "./apiFootballProvider";
import { OpenLigaDbProvider } from "./openLigaDbProvider";
import { FootballDataProvider } from "./footballDataProvider";

export type { SportsApiProvider, SportsApiProviderConfig } from "./base";
export type {
  ExternalMatch,
  ExternalCompetition,
  ExternalTeam,
  ExternalNewsArticle,
  ScheduledMatchAvailability,
} from "./base";
export { MockSportsApiProvider } from "./mockProvider";
export { ApiFootballProvider } from "./apiFootballProvider";
export { OpenLigaDbProvider } from "./openLigaDbProvider";
export { FootballDataProvider } from "./footballDataProvider";
export {
  type FutureFixturesProvider,
  NoopFutureFixturesProvider,
} from "./futureFixturesProvider";

/**
 * Creates a provider instance by ID.
 * Add new providers here as they are implemented.
 */
export function createProvider(
  id: string,
  config: SportsApiProviderConfig
): SportsApiProvider {
  switch (id) {
    case "api-football":
      return new ApiFootballProvider(config);
    case "openligadb":
      return new OpenLigaDbProvider(config);
    case "football-data":
      return new FootballDataProvider(config);
    case "mock":
    default:
      return new MockSportsApiProvider(config);
  }
}

export const availableProviders = [
  { id: "mock", name: "Mock Provider (Dev)", needsApiKey: false },
  { id: "api-football", name: "API-Football", needsApiKey: true },
  { id: "openligadb", name: "OpenLigaDB", needsApiKey: false },
  { id: "football-data", name: "Football-Data.org", needsApiKey: true },
] as const;
