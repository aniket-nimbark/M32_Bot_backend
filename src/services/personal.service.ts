import { GoogleGenAI } from "@google/genai";
import type {
  PersonalResponse,
  UserContext,
  ConversationHistory,
} from "../interface/types.js";

export class PersonalService {
  private readonly client: GoogleGenAI;
  private userContext: UserContext = {};
  private conversationHistory: ConversationHistory[] = [];

  constructor(geminiApiKey: string) {
    this.client = new GoogleGenAI({ apiKey: geminiApiKey });
  }

  async processMessage(
    message: string,
    initialContext: UserContext = {}
  ): Promise<PersonalResponse> {
    if (Object.keys(initialContext).length > 0) {
      this.userContext = { ...this.userContext, ...initialContext };
    }

    const extractedInfo = this.extractPersonalInfo(message);
    if (Object.keys(extractedInfo).length > 0) {
      this.mergeContext(extractedInfo);
    }

    const context = this.buildConversationContext();

    const prompt = `${context}

The user is engaging in personal conversation or sharing personal information. Please:
1. Respond in a warm, friendly, and engaging manner
2. Show interest in their personal information
3. Ask follow-up questions to learn more about them
4. Remember and reference their context appropriately
5. Build rapport and maintain a conversational tone

User message: "${message}"

Be personable and show genuine interest in getting to know them better.`;

    const response = await this.client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    const responseMessage =
      response.text || "I apologize, but I couldn't generate a response.";

    this.conversationHistory.push({
      user: message,
      assistant: responseMessage,
      timestamp: new Date().toISOString(),
    });

    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    return {
      message: responseMessage,
      contextExtracted: extractedInfo,
      suggestedFollowUps: this.generateFollowUpQuestions(),
      confidence: 0.8,
    };
  }

  private extractPersonalInfo(message: string): Record<string, any> {
    const info: Record<string, any> = {};

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

  private mergeContext(newContext: Partial<UserContext>): void {
    if (newContext.name) {
      this.userContext.name = newContext.name;
    }
    if (newContext.age) {
      this.userContext.age = newContext.age;
    }
    if (newContext.location) {
      this.userContext.location = newContext.location;
    }
    if (newContext.profession) {
      this.userContext.profession = newContext.profession;
    }

    if (newContext.interests && newContext.interests.length > 0) {
      this.userContext.interests = this.userContext.interests || [];
      newContext.interests.forEach((interest) => {
        if (!this.userContext.interests!.includes(interest)) {
          this.userContext.interests!.push(interest);
        }
      });
    }

    if (newContext.favorites) {
      this.userContext.favorites = this.userContext.favorites || {};
      Object.entries(newContext.favorites).forEach(([key, value]) => {
        if (value) {
          this.userContext.favorites![key] = value;
        }
      });
    }
  }

  private buildConversationContext(): string {
    let context = "You are a helpful Personal Assistant chatbot. ";

    if (Object.keys(this.userContext).length > 0) {
      context += "Here's what I know about the user: ";
      if (this.userContext.name) {
        context += `Their name is ${this.userContext.name}. `;
      }
      if (this.userContext.age) {
        context += `They are ${this.userContext.age} years old. `;
      }
      if (this.userContext.location) {
        context += `They live in ${this.userContext.location}. `;
      }
      if (this.userContext.profession) {
        context += `They work as ${this.userContext.profession}. `;
      }
      if (this.userContext.interests) {
        context += `They are interested in: ${this.userContext.interests.join(
          ", "
        )}. `;
      }
      if (this.userContext.favorites) {
        const favoriteEntries = Object.entries(this.userContext.favorites);
        if (favoriteEntries.length > 0) {
          const favoriteStrings = favoriteEntries.map(
            ([key, value]) => `${key}: ${value}`
          );
          context += `Their favorites include: ${favoriteStrings.join(", ")}. `;
        }
      }
    }

    if (this.conversationHistory.length > 0) {
      context += "Recent conversation history: ";
      const recentHistory = this.conversationHistory.slice(-3);
      recentHistory.forEach((exchange) => {
        context += `User: ${exchange.user}. Assistant: ${exchange.assistant}. `;
      });
    }

    return context;
  }

  private generateFollowUpQuestions(): string[] {
    const questions: string[] = [];

    if (!this.userContext.name) {
      questions.push("What's your name?");
    }
    if (!this.userContext.age) {
      questions.push("How old are you?");
    }
    if (!this.userContext.location) {
      questions.push("Where are you from?");
    }
    if (
      !this.userContext.interests ||
      this.userContext.interests.length === 0
    ) {
      questions.push("What are you interested in?");
    }

    return questions.slice(0, 2);
  }

  getUserContext(): UserContext {
    return this.userContext;
  }

  getConversationHistory(): ConversationHistory[] {
    return this.conversationHistory;
  }

  clearHistory(): void {
    this.conversationHistory = [];
    this.userContext = {};
  }
}


