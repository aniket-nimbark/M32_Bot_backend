import { GoogleGenAI } from "@google/genai";
import { HealthcareService } from "./healthcare.service.js";
import { PersonalService } from "./personal.service.js";
import type { ChatResponse, UserContext } from "../interface/types.js";

export class AgentRouterService {
  private readonly client: GoogleGenAI;
  private healthcareService: HealthcareService;
  private personalService: PersonalService;

  constructor(
    geminiApiKey: string,
    serpApiKey?: string,
    personalService?: PersonalService
  ) {
    this.client = new GoogleGenAI({ apiKey: geminiApiKey });
    this.healthcareService = new HealthcareService(geminiApiKey, serpApiKey);
    this.personalService = personalService || new PersonalService(geminiApiKey);
  }

  async chat(message: string): Promise<ChatResponse> {
    const startTime = Date.now();

    await this.extractAndUpdateContext(message);

    const healthcareScore = this.calculateHealthcareConfidence(message);
    const personalScore = this.calculatePersonalConfidence(message);

    const threshold = 0.3;

    if (healthcareScore >= threshold && healthcareScore > personalScore) {
      const result = await this.healthcareService.processHealthQuery(message);

      return {
        response: result.message,
        context: this.personalService.getUserContext(),
        newsArticles: result.newsArticles,
        papers_used: [], 
        metadata: {
          agent: "Healthcare Specialist",
          type: "healthcare",
          confidence: healthcareScore,
          routing: {
            selectedAgent: "Healthcare Specialist",
            confidence: healthcareScore,
            allScores: [
              { agent: "Healthcare Specialist", confidence: healthcareScore },
              { agent: "Personal Assistant", confidence: personalScore },
            ],
          },
          newsArticlesFound: result.newsArticles.length,
          news_articles: result.newsArticles,
          hasLatestNews: result.newsArticles.length > 0,
          medicalDisclaimer: result.medicalDisclaimer,
          topicCategories: result.topicCategories,
          processingTime: Date.now() - startTime,
        },
      };
    } else if (personalScore >= threshold && personalScore > healthcareScore) {
      // Personal Agent
      const result = await this.personalService.processMessage(message);

      return {
        response: result.message,
        context: this.personalService.getUserContext(),
        metadata: {
          agent: "Personal Assistant",
          type: "personal",
          confidence: personalScore,
          routing: {
            selectedAgent: "Personal Assistant",
            confidence: personalScore,
            allScores: [
              { agent: "Healthcare Specialist", confidence: healthcareScore },
              { agent: "Personal Assistant", confidence: personalScore },
            ],
          },
          contextExtracted: result.contextExtracted,
          suggestedFollowUps: result.suggestedFollowUps,
          processingTime: Date.now() - startTime,
        },
      };
    } else {
      return this.generateGeneralResponse(message, healthcareScore, personalScore, startTime);
    }
  }

  private async generateGeneralResponse(
    message: string,
    healthcareScore: number,
    personalScore: number,
    startTime: number
  ): Promise<ChatResponse> {
    const prompt = `You are a helpful AI assistant. The user has sent a message that doesn't clearly fit into any specific category. Please provide a helpful, general response and ask clarifying questions to better understand what they need help with.

User message: "${message}"

Please respond in a friendly, helpful manner and ask what specific type of assistance they need.`;

    const response = await this.client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    return {
      response:
        response.text ||
        "I'm here to help! Could you tell me more about what you'd like assistance with?",
      context: this.personalService.getUserContext(),
      metadata: {
        agent: "General Assistant",
        type: "general",
        confidence: 0.5,
        routing: {
          selectedAgent: "General",
          confidence: 0.5,
          reason: "No specialized agent confident enough",
          allScores: [
            { agent: "Healthcare Specialist", confidence: healthcareScore },
            { agent: "Personal Assistant", confidence: personalScore },
          ],
        },
        processingTime: Date.now() - startTime,
      },
    };
  }

  private calculateHealthcareConfidence(message: string): number {
    const healthcareKeywords = [
      "health",
      "medical",
      "disease",
      "symptom",
      "treatment",
      "medicine",
      "doctor",
      "hospital",
      "patient",
      "covid",
      "coronavirus",
      "vaccine",
      "vaccination",
      "pandemic",
      "epidemic",
      "virus",
      "bacteria",
      "infection",
      "diagnosis",
      "therapy",
      "pharmaceutical",
      "drug",
      "medication",
      "prescription",
      "wellness",
      "nutrition",
      "diet",
      "exercise",
      "fitness",
      "mental health",
      "depression",
      "anxiety",
      "stress",
      "healthcare",
      "clinical",
      "surgery",
      "cancer",
      "diabetes",
      "heart disease",
      "blood pressure",
      "blood",
      "cholesterol",
      "immunity",
      "immune system",
      "allergy",
      "asthma",
      "screening",
      "checkup",
      "check-up",
      "preventive care",
      "preventative",
      "hiv",
      "aids",
      "tuberculosis",
      "malaria",
      "dengue",
      "alzheimer",
      "obesity",
      "flu",
      "influenza",
      "clinical trial",
      "drug approval",
      "fda",
      "who",
      "cdc",
      "pain",
      "chest",
      "emergency",
      "urgent",
      "severe",
      "bleeding",
      "poisoning",
      "scan",
      "ct scan",
      "mri",
      "x-ray",
      "ultrasound",
      "biopsy",
      "mammogram",
      "colonoscopy",
      "endoscopy",
      "blood test",
      "lab test",
      "imaging",
      "radiology",
      "procedure",
      "test",
      "exam",
      "physical",
      "appointment",
      "consult",
      "specialist",
      "physician",
      "nurse",
      "clinic",
      "emergency room",
      "er",
      "urgent care",
      "primary care",
      "paper",
      "study",
      "research",
      "article",
      "publication",
      "journal",
      "published",
      "blog",
      "science",
      "evidence",
      "findings",
    ];

    const messageLower = message.toLowerCase();
    const keywordMatches = healthcareKeywords.filter((keyword) =>
      messageLower.includes(keyword)
    ).length;

    const hasHealthQuestions =
      /what is|how to|symptoms of|treatment for|cure for|prevent|risk of|should i|what.*screen/i.test(
        messageLower
      );
    const hasScreeningIntent =
      /screening|checkup|check-up|physical|exam|test.*for|preventive|preventative/.test(
        messageLower
      );
    const hasNewsIntent =
      /latest|news|recent|update|current|today|this week/.test(messageLower);

    let confidence = Math.min(keywordMatches / 2.5, 0.5);

    if (hasHealthQuestions) confidence += 0.3;
    if (hasScreeningIntent) confidence += 0.4;
    if (hasNewsIntent) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  private calculatePersonalConfidence(message: string): number {
    const messageLower = message.toLowerCase();

    const healthcareIndicators = [
      "covid", "vaccine", "disease", "symptom", "treatment", "medical",
      "doctor", "hospital", "patient", "diagnosis", "therapy", "medication",
      "cancer", "diabetes", "health", "paper", "study", "research", "article",
      "published", "journal", "infection", "virus", "drug", "prescription", "blood"
    ];
    
    const hasHealthcareContent = healthcareIndicators.some(keyword =>
      messageLower.includes(keyword)
    );

    if (hasHealthcareContent) return 0.2;

    const personalKeywords = [
      "hello",
      "hi",
      "hey",
      "how are you",
      "what's up",
      "thanks",
      "thank you",
      "my name is",
      "i am",
      "i'm",
      "i like",
      "i love",
      "i enjoy",
      "my favorite",
      "i work",
      "i live",
      "i'm from",
      "tell me about yourself",
      "who are you",
      "sorry",
      "excuse me",
    ];

    const hasPersonalKeywords = personalKeywords.some((keyword) =>
      messageLower.includes(keyword)
    );

    const contextKeywords = [
      "name",
      "age",
      "live",
      "from",
      "interested",
      "like",
      "enjoy",
      "favorite",
      "work",
      "job",
    ];
    const hasContextInfo = contextKeywords.some((keyword) =>
      messageLower.includes(keyword)
    );

    if (hasPersonalKeywords && hasContextInfo) return 0.9;
    if (hasPersonalKeywords) return 0.7;
    if (hasContextInfo) return 0.8;

    return 0.3;
  }

  clearHistory(): void {
    this.personalService.clearHistory();
  }

  getSystemInfo(): any {
    return {
      agents: [
        {
          name: "Healthcare Specialist",
          description:
            "Expert in medical information, health advice, and latest healthcare news",
          capabilities: [
            "Medical information and health advice",
            "Disease symptoms and prevention",
            "Healthcare news and latest research",
            "Wellness and nutrition guidance",
            "Mental health support",
            "Pharmaceutical information",
            "Healthcare policy and public health",
          ],
        },
        {
          name: "Personal Assistant",
          description:
            "Handles personal conversations, context management, and user preferences",
          capabilities: [
            "Personal conversation and small talk",
            "Context extraction and management",
            "User preference learning",
            "Memory management",
            "Relationship building",
          ],
        },
      ],
      userContext: this.personalService.getUserContext(),
      conversationHistory: this.personalService.getConversationHistory(),
    };
  }

  private async extractAndUpdateContext(message: string): Promise<void> {
    const personalInfoKeywords = [
      "name",
      "age",
      "live",
      "from",
      "interested",
      "like",
      "enjoy",
      "favorite",
      "favourite",
      "work",
      "job",
      "profession",
      "hobby",
      "i am",
      "i'm",
      "my",
      "call me",
    ];

    const hasPersonalInfo = personalInfoKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword)
    );

    if (hasPersonalInfo) {
      const extractedInfo = this.extractPersonalInfo(message);
      if (Object.keys(extractedInfo).length > 0) {
        const currentContext = this.personalService.getUserContext();
        this.updateContext(currentContext, extractedInfo);
      }
    }
  }

  private extractPersonalInfo(message: string): Partial<UserContext> {
    const info: Partial<UserContext> = {};

    const nameMatch = message.match(/my name is ([a-zA-Z\s]+?)(?:\s|,|\.|$)/i);
    if (nameMatch && nameMatch[1]) {
      info.name = nameMatch[1].trim();
    }

    const ageMatch = message.match(/i am (\d+) years old/i);
    if (ageMatch && ageMatch[1]) {
      info.age = ageMatch[1];
    }

    const locationMatch = message.match(/i live in ([^.!?]+?)(?:\s|,|\.|$)/i);
    if (locationMatch && locationMatch[1]) {
      info.location = locationMatch[1].trim();
    }

    const interestMatch = message.match(
      /i am interested in ([^.!?]+?)(?:\s|,|\.|$)/i
    );
    if (interestMatch && interestMatch[1]) {
      info.interests = [interestMatch[1].trim()];
    }

    const professionMatch = message.match(
      /i (?:am a|work as|am an) ([^.!?]+?)(?:\s|,|\.|$)/i
    );
    if (professionMatch && professionMatch[1]) {
      info.profession = professionMatch[1].trim();
    }

    return info;
  }

  private updateContext(
    currentContext: UserContext,
    newContext: Partial<UserContext>
  ): void {
    if (newContext.name) {
      currentContext.name = newContext.name;
    }
    if (newContext.age) {
      currentContext.age = newContext.age;
    }
    if (newContext.location) {
      currentContext.location = newContext.location;
    }
    if (newContext.profession) {
      currentContext.profession = newContext.profession;
    }

    if (newContext.interests && newContext.interests.length > 0) {
      currentContext.interests = currentContext.interests || [];
      newContext.interests.forEach((interest) => {
        if (!currentContext.interests!.includes(interest)) {
          currentContext.interests!.push(interest);
        }
      });
    }

    if (newContext.favorites) {
      currentContext.favorites = currentContext.favorites || {};
      Object.entries(newContext.favorites).forEach(([key, value]) => {
        if (value) {
          currentContext.favorites![key] = value;
        }
      });
    }
  }
}

