export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  
  geminiApiKey: process.env.GEMINI_API_KEY!,
  serpApiKey: process.env.SERP_API_KEY,
  
  apiTimeout: parseInt(process.env.API_TIMEOUT || "10000", 10),
  geminiTimeout: parseInt(process.env.GEMINI_TIMEOUT || "30000", 10),
  
  logLevel: process.env.LOG_LEVEL || "info",
};

export default config;


