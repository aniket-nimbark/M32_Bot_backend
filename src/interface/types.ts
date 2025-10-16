export interface UserContext {
  name?: string;
  age?: string;
  location?: string;
  interests?: string[];
  favorites?: Record<string, string>;
  profession?: string;
}

export interface ConversationHistory {
  user: string;
  assistant: string;
  timestamp: string;
}

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  date: string;
  snippet: string;
  thumbnail?: string;
}

export interface HealthcareResponse {
  message: string;
  newsArticles: NewsArticle[];
  confidence: number;
  topicCategories: string[];
  medicalDisclaimer: boolean;
}

export interface PersonalResponse {
  message: string;
  contextExtracted: Record<string, any>;
  suggestedFollowUps: string[];
  confidence: number;
}

export interface AgentResponse {
  message: string;
  confidence: number;
  metadata: Record<string, any>;
  nextAgent?: string;
  shouldContinue: boolean;
}

export interface AgentContext {
  userContext: UserContext;
  conversationHistory: ConversationHistory[];
  currentTopic: string;
  sessionId: string;
  memory: Map<string, any>;
}

export interface ChatResponse {
  response: string;
  context: UserContext;
  newsArticles?: NewsArticle[];
  papers_used?: any[];
  metadata: {
    agent: string;
    type: string;
    confidence: number;
    routing?: any;
    newsArticlesFound?: number;
    news_articles?: NewsArticle[];
    hasLatestNews?: boolean;
    medicalDisclaimer?: boolean;
    topicCategories?: string[];
    contextExtracted?: Record<string, any>;
    suggestedFollowUps?: string[];
    processingTime?: number;
  };
}