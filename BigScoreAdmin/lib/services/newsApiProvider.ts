import type { ExternalNewsArticle, NewsApiProviderConfig } from "@/models/newsArticle";

export interface NewsApiProvider {
  readonly name: string;
  readonly config: NewsApiProviderConfig;
  fetchArticles(): Promise<ExternalNewsArticle[]>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}

const SOCCER_KEYWORDS_API = [
  "soccer",
  "Premier League",
  "FIFA",
  "MLS",
];

const SOCCER_KEYWORDS_FILTER = [
  "football",
  "soccer",
  "FIFA World Cup",
  "World Cup",
  "Champions League",
  "UEFA Europa",
  "UEFA",
  "Copa America",
  "AFCON",
  "Premier League",
  "EPL",
  "La Liga",
  "laliga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "MLS",
  "FIFA",
  "transfer",
];

const AMERICAN_FOOTBALL_EXCLUSIONS = [
  "NFL",
  "college football",
  "American football",
  "quarterback",
  "touchdown",
  "Super Bowl",
  "NCAA football",
];

const NEWS_CATEGORY_MAP: Record<string, string> = {
  sports: "League News",
  politics: "Other",
  business: "Other",
  technology: "Other",
  entertainment: "Other",
  health: "Other",
  science: "Other",
};

interface NewsdataIoArticle {
  article_id: string;
  title: string;
  link: string;
  description: string;
  content: string;
  pubDate: string;
  image_url: string | null;
  source_name: string;
  source_url: string;
  category: string[];
  language: string;
  country: string[];
}

interface NewsdataIoResponse {
  status: string;
  totalResults: number;
  results: NewsdataIoArticle[];
  nextPage?: string;
}

function isStrictlySoccerArticle(item: NewsdataIoArticle): boolean {
  const title = (item.title || "").toLowerCase();
  const description = (item.description || "").toLowerCase();
  const content = (item.content || "").toLowerCase();
  const categories = Array.isArray(item.category) ? item.category.join(" ").toLowerCase() : "";

  const searchText = `${title} ${description} ${content} ${categories}`;

  for (const exclusion of AMERICAN_FOOTBALL_EXCLUSIONS) {
    if (searchText.includes(exclusion.toLowerCase())) {
      return false;
    }
  }

  for (const keyword of SOCCER_KEYWORDS_FILTER) {
    if (searchText.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

export class NewsdataIOProvider implements NewsApiProvider {
  readonly name: string;
  readonly config: NewsApiProviderConfig;
  private readonly apiKey: string | undefined;
  private readonly language: string;

  constructor(config: NewsApiProviderConfig) {
    this.name = config.name;
    this.config = config;
    this.apiKey = process.env[config.apiKeySecretName] || process.env.NEWSDATA_IO_API_KEY;
    this.language = config.language || "en";
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey) {
      return {
        success: false,
        message: `API key not found. Make sure ${this.config.apiKeySecretName || "NEWSDATA_IO_API_KEY"} is set in environment variables.`,
      };
    }

    try {
      const url = this.buildUrl(3);
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `API request failed: ${response.status} ${response.statusText}. ${errorText.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as NewsdataIoResponse;

      if (data.status === "error") {
        return {
          success: false,
          message: `API returned error: ${JSON.stringify(data).slice(0, 200)}`,
        };
      }

      return {
        success: true,
        message: `Connected successfully! Found ${data.totalResults || data.results?.length || 0} articles (language: ${this.language}).`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message: `Connection test failed: ${message}` };
    }
  }

  async fetchArticles(): Promise<ExternalNewsArticle[]> {
    if (!this.apiKey) {
      console.warn("[NewsdataIOProvider] No API key configured, skipping fetch.");
      return [];
    }

    try {
      const url = this.buildUrl(50);
      console.log(`[NewsdataIOProvider] Fetching news (language: ${this.language})...`);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[NewsdataIOProvider] API request failed: ${response.status} ${response.statusText}`,
          errorText.slice(0, 500)
        );
        return [];
      }

      const data = (await response.json()) as NewsdataIoResponse;

      if (data.status === "error" || !Array.isArray(data.results)) {
        console.error("[NewsdataIOProvider] API returned error:", data);
        return [];
      }

      const results = data.results || [];
      console.log(`[NewsdataIOProvider] Received ${results.length} articles from API (language: ${this.language})`);

      const articles: ExternalNewsArticle[] = [];

      for (const item of results) {
        if (!this.isRelevantArticle(item)) {
          continue;
        }

        const article = this.convertToExternalArticle(item);
        if (article) {
          articles.push(article);
        }
      }

      console.log(`[NewsdataIOProvider] Filtered to ${articles.length} relevant articles (language: ${this.language})`);

      return articles;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[NewsdataIOProvider] Fetch failed: ${message}`);
      return [];
    }
  }

  private isRelevantArticle(item: NewsdataIoArticle): boolean {
    if (this.language === "en") {
      return isStrictlySoccerArticle(item);
    }
    return true;
  }

   private buildUrl(limit: number): string {
     const baseUrl = this.config.endpointUrl || "https://newsdata.io/api/1/news";

     const params = new URLSearchParams();
     params.append("apikey", this.apiKey || "");
     params.append("category", "sports");
     params.append("language", this.language);
     params.append("size", String(Math.min(limit, 10)));

     if (this.language === "en") {
       const keywordsQuery = SOCCER_KEYWORDS_API.map((k) => `"${k}"`).join(" OR ");
       params.append("q", keywordsQuery);
     }

     return `${baseUrl}?${params.toString()}`;
   }

  private convertToExternalArticle(item: NewsdataIoArticle): ExternalNewsArticle | null {
    if (!item.title || !item.article_id) {
      return null;
    }

    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();

    let body = "";
    if (item.content && item.content.length > 100) {
      body = item.content;
    } else if (item.description && item.description.length > 50) {
      body = item.description;
    } else {
      body = item.title + " - " + (item.description || "");
    }

    let category = "League News";
    const itemCategories = Array.isArray(item.category) ? item.category : [];
    for (const cat of itemCategories) {
      if (NEWS_CATEGORY_MAP[cat.toLowerCase()]) {
        category = NEWS_CATEGORY_MAP[cat.toLowerCase()];
        break;
      }
    }

    const titleLower = item.title.toLowerCase();
    if (titleLower.includes("transfer")) {
      category = "Transfer News";
    } else if (titleLower.includes("injury") || titleLower.includes("injured") || titleLower.includes("out for")) {
      category = "Injury Update";
    } else if (titleLower.includes("interview") || titleLower.includes("press conference")) {
      category = "Interview";
    } else if (titleLower.includes("opinion") || titleLower.includes("analysis") || titleLower.includes("predicts")) {
      category = "Opinion";
    } else if (titleLower.includes("match report") || titleLower.includes("vs") || titleLower.includes("defeat") || titleLower.includes("victory") || titleLower.includes("beat") || titleLower.includes("draw")) {
      category = "Match Report";
    }

    const imageUrl = item.image_url && item.image_url.startsWith("http") ? item.image_url : undefined;

    return {
      externalId: `newsdataio-${item.article_id}`,
      title: item.title,
      summary: item.description || undefined,
      body: body,
      imageUrl: imageUrl,
      category: category,
      sourceName: item.source_name || "NewsData.io",
      sourceUrl: item.link || item.source_url || undefined,
      publishedAt: pubDate,
      language: this.language,
    };
  }
}

export class MockNewsApiProvider implements NewsApiProvider {
  readonly name: string;
  readonly config: NewsApiProviderConfig;

  constructor(config: NewsApiProviderConfig) {
    this.name = config.name;
    this.config = config;
  }

  async fetchArticles(): Promise<ExternalNewsArticle[]> {
    const now = new Date();
    return [
      {
        externalId: "mock-news-001",
        title: "Transfer Window: Latest Updates Across Europe",
        summary: "A roundup of the biggest moves and rumors from the transfer window.",
        body: "Full article body about transfer window updates across the major European leagues including Premier League, La Liga, Serie A, and Bundesliga. Clubs are making strategic moves ahead of the season.",
        imageUrl: "https://placehold.co/800x450/1C1F26/B8C5D6?text=Transfer+News",
        category: "Transfer News",
        sourceName: "Mock News API",
        sourceUrl: "",
        publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        externalId: "mock-news-002",
        title: "Champions League Quarter-Final Draw Results",
        summary: "The draw for the Champions League quarter-finals has been completed.",
        body: "The quarter-final pairings have been announced. Exciting matchups await as the tournament reaches its crucial stages.",
        imageUrl: "https://placehold.co/800x450/1C1F26/B8C5D6?text=UCL+Draw",
        category: "League News",
        sourceName: "Mock News API",
        sourceUrl: "",
        publishedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      },
      {
        externalId: "mock-news-003",
        title: "Injury Report: Key Players Ruled Out This Weekend",
        summary: "Several star players will miss their upcoming fixtures due to injury.",
        body: "Injury updates from across the major leagues. Teams adjust their lineups as key players face spells on the sidelines.",
        imageUrl: "https://placehold.co/800x450/1C1F26/B8C5D6?text=Injury+Report",
        category: "Injury Update",
        sourceName: "Mock News API",
        sourceUrl: "",
        publishedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      },
    ];
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: "Mock provider is always connected." };
  }
}

export function createNewsProvider(config: NewsApiProviderConfig): NewsApiProvider {
  if (config.providerType === "newsdata_io") {
    return new NewsdataIOProvider(config);
  }

  const nameLower = config.name.toLowerCase();

  if (nameLower.includes("newsdata") || nameLower.includes("news-data")) {
    return new NewsdataIOProvider(config);
  }

  if (config.apiKeySecretName === "NEWSDATA_IO_API_KEY" || (process.env.NEWSDATA_IO_API_KEY && !config.name)) {
    return new NewsdataIOProvider(config);
  }

  if (config.name === "sportmonks-news") {
    return new MockNewsApiProvider(config);
  }

  return new MockNewsApiProvider(config);
}
