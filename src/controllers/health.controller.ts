import { Request, Response } from "express";
import { HealthcareService } from "../services/healthcare.service.js";
import { PersonalService } from "../services/personal.service.js";
import { AgentRouterService } from "../services/agent-router.service.js";

export class HealthController {
  private static healthcareService: HealthcareService;
  private static personalService: PersonalService;
  private static agentRouter: AgentRouterService;

  constructor() {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const serpApiKey = process.env.SERP_API_KEY;

    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }

    if (!HealthController.healthcareService) {
      HealthController.healthcareService = new HealthcareService(geminiApiKey, serpApiKey);
      HealthController.personalService = new PersonalService(geminiApiKey);
      HealthController.agentRouter = new AgentRouterService(
        geminiApiKey, 
        serpApiKey, 
        HealthController.personalService
      );
    }
  }

  private get healthcareService() {
    return HealthController.healthcareService;
  }

  private get personalService() {
    return HealthController.personalService;
  }

  private get agentRouter() {
    return HealthController.agentRouter;
  }


  chat = async (req: Request, res: Response): Promise<void> => {
    try {
      const { prompt, isNewChat = false } = req.body;

      if (!prompt) {
        res.status(400).json({
          error: "prompt is required",
          prompt: "",
          answer: "",
          papers_used: [],
          context: {},
          isNewChat: false,
        });
        return;
      }

      if (isNewChat) {
        this.agentRouter.clearHistory();
      }

      const result = await this.agentRouter.chat(prompt);

      res.json({
        prompt,
        answer: result.response,
        papers_used: result.papers_used || [],
        context: result.context,
        metadata: result.metadata,
        isNewChat,
      });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({
        error: "Internal server error",
        message: (error as Error).message,
        prompt: req.body.prompt || "",
        answer: "",
        papers_used: [],
        context: {},
        isNewChat: false,
      });
    }
  };

  healthcareConsult = async (req: Request, res: Response): Promise<void> => {
    try {
      const { query, fetchNews = true } = req.body;

      if (!query) {
        res.status(400).json({
          success: false,
          error: "query is required",
        });
        return;
      }

      const result = await this.healthcareService.processHealthQuery(
        query,
        fetchNews
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error in healthcare consult:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  };

  getHealthNews = async (req: Request, res: Response): Promise<void> => {
    try {
      const { topic = "health medical news" } = req.query;

      const news = await this.healthcareService.fetchHealthNews(
        topic as string
      );

      res.json({
        success: true,
        data: {
          topic,
          articles: news,
          count: news.length,
        },
      });
    } catch (error) {
      console.error("Error fetching health news:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  };

  personalChat = async (req: Request, res: Response): Promise<void> => {
    try {
      const { message, context = {} } = req.body;

      if (!message) {
        res.status(400).json({
          success: false,
          error: "message is required",
        });
        return;
      }

      const result = await this.personalService.processMessage(
        message,
        context
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error in personal chat:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  };

  getUserContext = async (req: Request, res: Response): Promise<void> => {
    try {
      const context = this.personalService.getUserContext();

      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      console.error("Error getting user context:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  };

  clearHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      this.agentRouter.clearHistory();
      this.personalService.clearHistory();

      res.json({
        success: true,
        message: "Conversation history cleared",
      });
    } catch (error) {
      console.error("Error clearing history:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  };

  healthCheck = async (req: Request, res: Response): Promise<void> => {
    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      agents: ["Healthcare Specialist", "Personal Assistant"],
    });
  };

  getSystemInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const info = this.agentRouter.getSystemInfo();

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      console.error("Error getting system info:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  };
}

