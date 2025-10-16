import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";
import type { NewsArticle, HealthcareResponse } from "../interface/types.js";

export class HealthcareService {
  private readonly client: GoogleGenAI;
  private readonly serpApiKey?: string;

  constructor(geminiApiKey: string, serpApiKey?: string) {
    this.client = new GoogleGenAI({ apiKey: geminiApiKey });
    this.serpApiKey = serpApiKey;
  }

  async processHealthQuery(
    query: string,
    shouldFetchNews: boolean = true
  ): Promise<HealthcareResponse> {
    const messageLower = query.toLowerCase();

    let newsArticles: NewsArticle[] = [];

    if (shouldFetchNews) {
      console.log(`[HealthcareService] Fetching news for query: "${query}"`);
      newsArticles = await this.fetchHealthNews(query);
    }

    let newsContext = "";
    if (newsArticles.length > 0) {
      newsContext = `\n\nRELEVANT HEALTH NEWS & ARTICLES:\n`;
      newsArticles.forEach((article, index) => {
        newsContext += `\n[${index + 1}] ${article.title}\n`;
        newsContext += `Source: ${article.source} | Date: ${article.date}\n`;
        newsContext += `Summary: ${article.snippet}\n`;
        newsContext += `URL: ${article.link}\n`;
      });

      newsContext += `\n\nYou may reference these articles in your response if relevant, using citations like [1], [2], etc.`;
    }

    const prompt = `You are a Healthcare Specialist AI assistant.

The user is asking a healthcare-related question. Please:
1. Provide accurate, evidence-based medical information
2. Include appropriate medical disclaimers when necessary
3. Cite latest news articles if available
4. Recommend consulting healthcare professionals for medical advice
5. Be empathetic and supportive in your tone

${newsContext}

User message: "${query}"

IMPORTANT DISCLAIMERS:
- This is for informational purposes only and not a substitute for professional medical advice
- Always recommend consulting with qualified healthcare providers for medical decisions
- Be clear about limitations and when professional help is needed

Provide a comprehensive yet accessible response.`;

    const response = await this.client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    const message =
      response.text || "I apologize, but I couldn't generate a response.";

    return {
      message,
      newsArticles,
      confidence: 0.88,
      topicCategories: this.categorizeHealthTopic(query),
      medicalDisclaimer: true,
    };
  }

  async fetchHealthNews(query: string): Promise<NewsArticle[]> {
    try {
      if (!this.serpApiKey) {
        console.log("[HealthcareService] ERROR: SERP_API_KEY not found, cannot fetch news");
        return [];
      }

      const searchQuery = this.extractHealthTopic(query);
      const url = `https://serpapi.com/search?engine=google_news&q=${encodeURIComponent(
        searchQuery
      )}&api_key=${this.serpApiKey}`;
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(
          parseInt(process.env.API_TIMEOUT || "10000")
        ),
      });

      if (!response.ok) {
        console.log(`[HealthcareService] SerpAPI error: ${response.status}, returning empty news`);
        return [];
      }

      const data = (await response.json()) as any;  
      
      const articles = this.parseSerpApiResponse(data);
      
      return articles;
    } catch (error) {
      console.log("[HealthcareService] Error fetching news:", error);
      return [];
    }
  }

  private parseSerpApiResponse(data: any): NewsArticle[] {
    const articles: NewsArticle[] = [];
    const MAX_ARTICLES = 5; 

    if (data.news_results && Array.isArray(data.news_results)) {
      data.news_results.slice(0, MAX_ARTICLES).forEach((item: any) => {
        articles.push({
          title: item.title || "Untitled",
          link: item.link || "",
          source: item.source?.name || item.source || "Unknown Source",
          date: item.date || new Date().toISOString().split("T")[0],
          snippet: item.snippet || "No description available",
          thumbnail: item.thumbnail || undefined,
        });
      });
    }

    return articles;
  }

  private extractHealthTopic(message: string): string {
    const messageLower = message.toLowerCase();

    const topics = [
      "covid",
      "coronavirus",
      "vaccine",
      "cancer",
      "diabetes",
      "heart disease",
      "mental health",
      "alzheimer",
      "obesity",
      "flu",
      "influenza",
      "hiv",
      "aids",
      "tuberculosis",
      "malaria",
      "dengue",
      "healthcare",
      "medical research",
      "clinical trial",
      "drug approval",
      "fda",
      "who",
      "cdc",
      "blood"
    ];

    const foundTopic = topics.find((topic) => messageLower.includes(topic));

    if (foundTopic) {
      return `${foundTopic} health news`;
    }

    return "health medical news";
  }

  private categorizeHealthTopic(message: string): string[] {
    const categories: string[] = [];
    const messageLower = message.toLowerCase();

    const categoryMap: Record<string, string[]> = {
      infectious_diseases: [
        "covid",
        "coronavirus",
        "flu",
        "virus",
        "bacteria",
        "infection",
        "pandemic",
        "epidemic",
      ],
      chronic_diseases: [
        "diabetes",
        "cancer",
        "heart disease",
        "hypertension",
        "arthritis",
        "asthma",
        "blood",
      ],
      mental_health: [
        "mental health",
        "depression",
        "anxiety",
        "stress",
        "ptsd",
        "therapy",
      ],
      preventive_care: [
        "vaccine",
        "vaccination",
        "prevention",
        "screening",
        "check-up",
        "wellness",
      ],
      nutrition_fitness: [
        "nutrition",
        "diet",
        "exercise",
        "fitness",
        "weight",
        "obesity",
      ],
      pharmaceuticals: [
        "drug",
        "medication",
        "prescription",
        "pharmaceutical",
        "FDA",
      ],
      public_health: [
        "public health",
        "healthcare policy",
        "WHO",
        "CDC",
        "healthcare system",
      ],
    };

    Object.entries(categoryMap).forEach(([category, keywords]) => {
      if (keywords.some((keyword) => messageLower.includes(keyword))) {
        categories.push(category);
      }
    });

    return categories.length > 0 ? categories : ["general_health"];
  }
}

