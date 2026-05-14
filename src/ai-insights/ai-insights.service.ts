// Heartbeat: 2026-05-14T09:25:35
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiInsight, AiInsightDocument } from './schemas/ai-insight.schema';

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(
    private configService: ConfigService,
    @InjectModel(AiInsight.name) private aiInsightModel: Model<AiInsightDocument>
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set in environment variables. AI insights will not work.');
    } else {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Using gemini-2.5-flash for the fastest, most reliable generation
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        this.logger.log('Google Generative AI successfully initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Google Generative AI', error);
      }
    }
  }

  /**
   * Generates actionable suggestions for farmers based on farm data
   */
  async getFarmerSuggestions(farmData: any, weatherData: any, ndviData: any): Promise<any> {
    const farmId = farmData._id || farmData.id;
    if (!farmId) throw new InternalServerErrorException('Farm ID is required for persistence.');

    // Check for existing insight
    const existing = await this.aiInsightModel.findOne({ 
      contextId: new Types.ObjectId(farmId), 
      role: 'FARMER', 
      type: 'SUGGESTIONS' 
    });
    
    if (existing) return existing;

    if (!this.model) {
      throw new InternalServerErrorException('AI Model is not configured.');
    }

    const prompt = `
      You are an expert agricultural AI assistant named Starhawk AI.
      Analyze the following data for a farmer's field and provide exactly 3 short, highly actionable suggestions.
      
      Farm Details: ${JSON.stringify(farmData)}
      Weather: ${JSON.stringify(weatherData)}
      NDVI: ${JSON.stringify(ndviData)}
      
      Guidelines:
      1. Provide exactly 3 bullet points.
      2. Focus on practical farming advice.
      3. Format response as a single string of 3 bullet points.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const content = (await result.response).text();
      
      // Persist
      return await this.aiInsightModel.create({
        role: 'FARMER',
        type: 'SUGGESTIONS',
        contextId: new Types.ObjectId(farmId),
        contextModel: 'Farm',
        data: content,
        conversation: [{ role: 'model', content }]
      });
    } catch (error) {
      this.logger.error('Error generating AI farmer insight:', error);
      throw new InternalServerErrorException('Failed to generate insights.');
    }
  }
  
  /**
   * Generates a risk analysis summary for assessors/insurers based on claims
   */
  async getRiskAnalysis(claimData: any, farmData: any, satelliteData: any, role?: string): Promise<any> {
    const claimId = claimData._id || claimData.id;
    if (!claimId) throw new InternalServerErrorException('Claim ID is required.');

    // Determine role if not provided
    const targetRole = role || (claimData.status === 'PENDING' ? 'ASSESSOR' : 'INSURER');

    const existing = await this.aiInsightModel.findOne({ 
      contextId: new Types.ObjectId(claimId), 
      type: 'RISK_ANALYSIS',
      role: targetRole
    });
    
    if (existing) return existing;

    if (!this.model) {
      throw new InternalServerErrorException('AI Model is not configured.');
    }

    const prompt = `
      You are an expert agricultural insurance risk assessor AI.
      Analyze this insurance claim against the farm data and satellite data.
      
      Claim Data: ${JSON.stringify(claimData)}
      Farm Data: ${JSON.stringify(farmData)}
      Satellite/Weather: ${JSON.stringify(satelliteData)}
      
      Return STRICTLY JSON:
      {
        "riskLevel": "Low" | "Medium" | "High",
        "confidenceScore": number,
        "analysisSummary": "string",
        "redFlags": ["string"]
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      let text = (await result.response).text().trim();
      if (text.startsWith('```json')) text = text.replace(/^```json/g, '').replace(/```$/g, '').trim();
      const parsedData = JSON.parse(text);

      return await this.aiInsightModel.create({
        role: targetRole,
        type: 'RISK_ANALYSIS',
        contextId: new Types.ObjectId(claimId),
        contextModel: 'Claim',
        data: parsedData,
        conversation: [{ 
          role: 'model', 
          content: `Risk Level: **${parsedData.riskLevel}**\n\n${parsedData.analysisSummary}${parsedData.redFlags && parsedData.redFlags.length > 0 ? '\n\n**Potential Red Flags:**\n' + parsedData.redFlags.map((f: string) => `- ${f}`).join('\n') : ''}` 
        }]
      });
    } catch (error) {
      this.logger.error('Error generating AI risk analysis:', error);
      throw new InternalServerErrorException('Failed to generate risk analysis.');
    }
  }

  /**
   * Continues an existing AI conversation
   */
  async followUpChat(insightId: string, userMessage: string): Promise<any> {
    const insight = await this.aiInsightModel.findById(insightId);
    if (!insight) throw new NotFoundException('Insight conversation not found.');

    const history = insight.conversation.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    try {
      const chat = this.model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      const modelResponse = (await result.response).text();

      insight.conversation.push({ role: 'user', content: userMessage, timestamp: new Date() });
      insight.conversation.push({ role: 'model', content: modelResponse, timestamp: new Date() });
      insight.lastAccessed = new Date();
      
      return await insight.save();
    } catch (error) {
      this.logger.error('Error in AI follow-up chat:', error);
      throw new InternalServerErrorException('AI failed to respond.');
    }
  }

  /**
   * General purpose farm assessment summary
   */
  async getAssessmentSummary(farmData: any, fieldNotes: string): Promise<string> {
    if (!this.model) {
      throw new InternalServerErrorException('AI Model is not configured.');
    }

    const prompt = `
      You are an expert agricultural assessor AI.
      Summarize the field notes and farm data into a professional 1-paragraph executive summary for the insurer.
      
      Farm: ${JSON.stringify(farmData)}
      Field Notes: ${fieldNotes}
    `;

    try {
      const result = await this.model.generateContent(prompt);
      return (await result.response).text();
    } catch (error) {
      this.logger.error('Error generating assessment summary:', error);
      throw new InternalServerErrorException('Failed to generate assessment summary.');
    }
  }

  /**
   * Analyzes the monitoring cycle of a farm and provides marketability insights
   */
  async analyzeMonitoringCycle(farmData: any, historicalNdvi: any[], historicalWeather: any[]): Promise<any> {
    const farmId = farmData._id || farmData.id;
    if (!farmId) throw new InternalServerErrorException('Farm ID is required.');

    const existing = await this.aiInsightModel.findOne({ 
      contextId: new Types.ObjectId(farmId), 
      type: 'MONITORING_CYCLE' 
    });
    
    if (existing) return existing;

    if (!this.model) {
      throw new InternalServerErrorException('AI Model is not configured.');
    }

    const prompt = `
      You are an advanced Agricultural Data Scientist AI.
      Analyze the "Monitoring Cycle" of the following farm.
      
      Farm Info: ${JSON.stringify(farmData)}
      Historical NDVI: ${JSON.stringify(historicalNdvi)}
      Historical Weather: ${JSON.stringify(historicalWeather)}
      
      Return STRICTLY JSON:
      {
        "currentStage": "string",
        "healthTrend": "Improving" | "Stable" | "Declining",
        "anomalies": ["string"],
        "daysToHarvest": number,
        "marketValueScore": number,
        "cycleAnalysis": "string",
        "recommendations": ["string"],
        "investmentPotential": "string"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      let text = (await result.response).text().trim();
      if (text.startsWith('```json')) text = text.replace(/^```json/g, '').replace(/```$/g, '').trim();
      const parsedData = JSON.parse(text);

      return await this.aiInsightModel.create({
        role: 'FARMER',
        type: 'MONITORING_CYCLE',
        contextId: new Types.ObjectId(farmId),
        contextModel: 'Farm',
        data: parsedData,
        conversation: [{ 
          role: 'model', 
          content: `Monitoring Cycle Analysis: ${parsedData.cycleAnalysis}. Current Stage: ${parsedData.currentStage}.` 
        }]
      });
    } catch (error) {
      this.logger.error('Error analyzing monitoring cycle:', error);
      throw new InternalServerErrorException('Failed to generate cycle analysis.');
    }
  }

  /**
   * Finds an existing insight by context and type
   */
  async findByContext(contextId: string, type: string, role?: string): Promise<any> {
    const query: any = { 
      contextId: new Types.ObjectId(contextId), 
      type 
    };
    if (role) query.role = role;
    return await this.aiInsightModel.findOne(query);
  }
}
