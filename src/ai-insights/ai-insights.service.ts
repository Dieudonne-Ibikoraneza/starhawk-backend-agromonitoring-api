// Heartbeat: 2026-05-14T09:25:35
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiInsight, AiInsightDocument } from './schemas/ai-insight.schema';
import { Claim } from '../claims/schemas/claim.schema';
import { Farm } from '../farms/schemas/farm.schema';
import { Policy } from '../policies/schemas/policy.schema';

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(
    private configService: ConfigService,
    @InjectModel(AiInsight.name) private aiInsightModel: Model<AiInsightDocument>,
    @InjectModel(Claim.name) private claimModel: Model<any>,
    @InjectModel(Farm.name) private farmModel: Model<any>,
    @InjectModel(Policy.name) private policyModel: Model<any>,
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
      
      // Persist with full context for follow-up conversations
      return await this.aiInsightModel.create({
        role: 'FARMER',
        type: 'SUGGESTIONS',
        contextId: new Types.ObjectId(farmId),
        contextModel: 'Farm',
        data: content,
        conversation: [
          { role: 'user', content: prompt.trim() },
          { role: 'model', content }
        ]
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

    // Auto-enrich weather data if empty but farm has coordinates
    // Uses Open-Meteo API (free, no API key required)
    let enrichedSatelliteData = satelliteData;
    if ((!satelliteData || Object.keys(satelliteData).length === 0) && farmData?.location?.coordinates) {
      try {
        const [lon, lat] = farmData.location.coordinates;
        if (lat && lon) {
          // Fetch current weather + 7-day forecast from Open-Meteo
          const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,wind_speed_10m_max&timezone=auto&forecast_days=7`;
          const forecastRes = await fetch(forecastUrl);
          const forecastData = forecastRes.ok ? await forecastRes.json() : null;

          // Fetch 30-day historical weather
          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const historyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,wind_speed_10m_max&timezone=auto&start_date=${startDate}&end_date=${endDate}`;
          const historyRes = await fetch(historyUrl);
          const historyData = historyRes.ok ? await historyRes.json() : null;

          enrichedSatelliteData = {
            currentWeather: forecastData?.current ? {
              temperature: forecastData.current.temperature_2m,
              apparentTemperature: forecastData.current.apparent_temperature,
              humidity: forecastData.current.relative_humidity_2m,
              precipitation: forecastData.current.precipitation,
              rain: forecastData.current.rain,
              cloudCover: forecastData.current.cloud_cover,
              windSpeed: forecastData.current.wind_speed_10m,
              windDirection: forecastData.current.wind_direction_10m,
              weatherCode: forecastData.current.weather_code,
              fetchedAt: new Date().toISOString(),
            } : null,
            forecast7Day: forecastData?.daily ? forecastData.daily.time?.map((date: string, i: number) => ({
              date,
              tempMax: forecastData.daily.temperature_2m_max?.[i],
              tempMin: forecastData.daily.temperature_2m_min?.[i],
              precipitation: forecastData.daily.precipitation_sum?.[i],
              rain: forecastData.daily.rain_sum?.[i],
              windSpeedMax: forecastData.daily.wind_speed_10m_max?.[i],
            })) : [],
            historicalWeather30Days: historyData?.daily ? historyData.daily.time?.map((date: string, i: number) => ({
              date,
              tempMax: historyData.daily.temperature_2m_max?.[i],
              tempMin: historyData.daily.temperature_2m_min?.[i],
              precipitation: historyData.daily.precipitation_sum?.[i],
              rain: historyData.daily.rain_sum?.[i],
              windSpeedMax: historyData.daily.wind_speed_10m_max?.[i],
            })) : [],
          };
          this.logger.log(`Enriched AI prompt with live weather data for coordinates [${lat}, ${lon}]`);
        }
      } catch (weatherError) {
        this.logger.warn('Failed to fetch weather for AI enrichment, proceeding without it', weatherError);
      }
    }

    const prompt = `
      You are an expert agricultural insurance risk assessor AI named Starhawk AI.
      You have access to the following comprehensive data. Use ALL of it to provide detailed, data-driven analysis.
      
      Claim Data: ${JSON.stringify(claimData)}
      Farm Data: ${JSON.stringify(farmData)}
      Weather & Satellite Data: ${JSON.stringify(enrichedSatelliteData)}
      Current Date: ${new Date().toISOString()}
      
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

      // Store full context so follow-up questions have access to all farm/claim details
      return await this.aiInsightModel.create({
        role: targetRole,
        type: 'RISK_ANALYSIS',
        contextId: new Types.ObjectId(claimId),
        contextModel: 'Claim',
        data: parsedData,
        conversation: [
          { role: 'user', content: prompt.trim() },
          { 
            role: 'model', 
            content: `Risk Level: **${parsedData.riskLevel}**\n\n${parsedData.analysisSummary}${parsedData.redFlags && parsedData.redFlags.length > 0 ? '\n\n**Potential Red Flags:**\n' + parsedData.redFlags.map((f: string) => `- ${f}`).join('\n') : ''}` 
          }
        ]
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

    const rawHistory = insight.conversation.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    // Gemini requires history to start with role 'user'.
    // Legacy insights may only have a 'model' entry, so prepend a synthetic prompt.
    const history = rawHistory[0]?.role === 'model'
      ? [{ role: 'user', parts: [{ text: 'Analyze the claim and farm data I provided and give me your risk assessment.' }] }, ...rawHistory]
      : rawHistory;

    try {
      const chat = this.model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      const modelResponse = (await result.response).text();

      insight.conversation.push({ role: 'user', content: userMessage, timestamp: new Date() });
      insight.conversation.push({ role: 'model', content: modelResponse, timestamp: new Date() });
      insight.lastAccessed = new Date();
      
      return await insight.save();
    } catch (error: any) {
      this.logger.error('Error in AI follow-up chat:', error);
      const message = error?.message || 'AI failed to respond.';
      // Extract the human-readable part from Gemini errors
      const match = message.match(/\[.*?\]\s*(.*)/);
      const userFriendlyMessage = match ? match[1] : message;
      throw new InternalServerErrorException(userFriendlyMessage);
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

  /**
   * Generates a portfolio-level AI insight for the insurer dashboard.
   * Aggregates claims, farms, and policies then asks Gemini for a strategic recommendation.
   * Uses a short TTL cache (1 hour) to avoid excessive API calls.
   */
  async getPortfolioInsight(forceRefresh = false, insurerId?: string): Promise<any> {
    // Generate a deterministic context ID based on insurerId or global
    let portfolioContextId: Types.ObjectId;
    try {
      portfolioContextId = insurerId 
        ? new Types.ObjectId(insurerId.toString().padStart(24, '0').slice(-24))
        : new Types.ObjectId('000000000000000000000001');
    } catch (e) {
      portfolioContextId = new Types.ObjectId('000000000000000000000001');
    }

    // Check for a recent cached insight (less than 1 hour old)
    if (!forceRefresh) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const cached = await this.aiInsightModel.findOne({
        type: 'PORTFOLIO_INSIGHT',
        role: 'INSURER',
        contextId: portfolioContextId,
        createdAt: { $gte: oneHourAgo },
      }).sort({ createdAt: -1 });

      if (cached) {
        this.logger.log(`Returning cached portfolio insight for ${insurerId || 'global'}`);
        return cached;
      }
    }

    if (!this.model) {
      throw new InternalServerErrorException('AI Model is not configured.');
    }

    // Aggregate portfolio data with filtering
    let policies: any[], claims: any[], farms: any[];
    
    try {
      if (insurerId) {
        const iId = new Types.ObjectId(insurerId);
        policies = await this.policyModel.find({ insurerId: iId }).sort({ createdAt: -1 }).limit(100).lean();
        const policyIds = policies.map(p => p._id);
        const farmIds = [...new Set(policies.map(p => p.farmId).filter(Boolean))];
        
        [claims, farms] = await Promise.all([
          this.claimModel.find({ policyId: { $in: policyIds } }).sort({ createdAt: -1 }).limit(50).lean(),
          this.farmModel.find({ _id: { $in: farmIds } }).lean(),
        ]);
      } else {
        [claims, farms, policies] = await Promise.all([
          this.claimModel.find().sort({ createdAt: -1 }).limit(50).lean(),
          this.farmModel.find().sort({ createdAt: -1 }).limit(50).lean(),
          this.policyModel.find().sort({ createdAt: -1 }).limit(50).lean(),
        ]);
      }
    } catch (err) {
      this.logger.error('Error fetching portfolio data for AI:', err);
      // Fallback to empty if IDs are malformed
      claims = []; farms = []; policies = [];
    }

    // Build concise summaries to keep the prompt focused
    const claimsSummary = {
      total: claims.length,
      byStatus: claims.reduce((acc: any, c: any) => {
        const s = (c.status || 'unknown').toUpperCase();
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {}),
      byLossType: claims.reduce((acc: any, c: any) => {
        const t = c.lossEventType || 'UNKNOWN';
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {}),
      totalClaimAmount: claims.reduce((sum: number, c: any) => sum + (c.claimAmount || 0), 0),
    };

    const farmsSummary = {
      total: farms.length,
      byCropType: farms.reduce((acc: any, f: any) => {
        const crop = f.cropType || 'UNKNOWN';
        acc[crop] = (acc[crop] || 0) + 1;
        return acc;
      }, {}),
      totalArea: farms.reduce((sum: number, f: any) => sum + (f.area || 0), 0),
    };

    const policiesSummary = {
      total: policies.length,
      byStatus: policies.reduce((acc: any, p: any) => {
        const s = (p.status || 'unknown').toUpperCase();
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {}),
      totalPremium: policies.reduce((sum: number, p: any) => sum + (p.premiumAmount || 0), 0),
      totalCoverage: policies.reduce((sum: number, p: any) => sum + (p.coverageAmount || 0), 0),
    };

    const prompt = `
You are Starhawk AI, an advanced agricultural insurance intelligence engine.
Analyze the following portfolio snapshot and produce a single, high-impact strategic insight.

=== PORTFOLIO DATA ===
Claims: ${JSON.stringify(claimsSummary)}
Farms: ${JSON.stringify(farmsSummary)}
Policies: ${JSON.stringify(policiesSummary)}
=== END DATA ===

Return STRICTLY valid JSON with this exact structure (no markdown fences):
{
  "title": "A concise, actionable headline (max 12 words)",
  "body": "A 2-3 sentence explanation of the insight. You MUST use specific numbers from the data provided above (e.g., 'With ${claims.length} claims across ${policies.length} policies...'). Be 100% accurate to the numbers provided.",
  "severity": "info" | "warning" | "critical",
  "cta": "Short button label (max 4 words)",
  "metrics": {
    "key1Label": "value1",
    "key2Label": "value2"
  }
}

Focus on the MOST IMPORTANT finding: risk concentration, anomaly patterns, pending actions, loss trends, or portfolio health.
`;

    try {
      const result = await this.model.generateContent(prompt);
      let text = (await result.response).text().trim();
      // Strip markdown fences if Gemini wraps in ```json
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      }

      const parsedData = JSON.parse(text);

      const insight = await this.aiInsightModel.create({
        role: 'INSURER',
        type: 'PORTFOLIO_INSIGHT',
        contextId: portfolioContextId,
        contextModel: 'Portfolio',
        data: parsedData,
        conversation: [
          { role: 'user', content: prompt.trim() },
          { role: 'model', content: text },
        ],
      });

      this.logger.log(`Portfolio insight generated for ${insurerId || 'global'}: ${parsedData.title}`);
      return insight;
    } catch (error) {
      this.logger.error('Error generating portfolio insight:', error);
      // Return a graceful fallback instead of crashing
      return {
        data: {
          title: 'Portfolio analysis available',
          body: `Your portfolio contains ${claims.length} claims across ${farms.length} farms with ${policies.length} policies. Review your recent submissions for detailed metrics.`,
          severity: 'info',
          cta: 'View details',
          metrics: { 'Claims': String(claims.length), 'Policies': String(policies.length) },
        },
      };
    }
  }
}
