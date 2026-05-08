import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(private configService: ConfigService) {
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
  async getFarmerSuggestions(farmData: any, weatherData: any, ndviData: any): Promise<string> {
    if (!this.model) {
      throw new InternalServerErrorException('AI Model is not configured or API key is missing.');
    }

    const prompt = `
      You are an expert agricultural AI assistant named Starhawk AI.
      Analyze the following data for a farmer's field and provide exactly 3 short, highly actionable suggestions.
      
      Farm Details:
      ${JSON.stringify(farmData, null, 2)}
      
      Recent Weather Forecast:
      ${JSON.stringify(weatherData, null, 2)}
      
      Satellite Vegetation Index (NDVI) Data:
      ${JSON.stringify(ndviData, null, 2)}
      
      Guidelines:
      1. Provide exactly 3 bullet points.
      2. Keep each point under 2 sentences.
      3. Focus on practical farming advice (e.g., watering, harvesting, pest control, fertilizer).
      4. Use a professional, encouraging, and easy-to-understand tone.
    `;

    try {
      this.logger.debug('Generating farmer suggestions...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      this.logger.error('Error generating AI farmer insight:', error);
      throw new InternalServerErrorException('Failed to generate insights from AI.');
    }
  }
  
  /**
   * Generates a risk analysis summary for assessors/insurers based on claims
   */
  async getRiskAnalysis(claimData: any, farmData: any, satelliteData: any): Promise<any> {
    if (!this.model) {
      throw new InternalServerErrorException('AI Model is not configured or API key is missing.');
    }

    const prompt = `
      You are an expert agricultural insurance risk assessor AI.
      Analyze this insurance claim against the farm data and satellite data to determine if the claim is valid or if there are red flags for fraud.
      
      Claim Data:
      ${JSON.stringify(claimData, null, 2)}
      
      Farm Data:
      ${JSON.stringify(farmData, null, 2)}
      
      Satellite & Weather Data around the time of loss:
      ${JSON.stringify(satelliteData, null, 2)}
      
      Please format your response strictly as a valid JSON object matching this schema:
      {
        "riskLevel": "Low" | "Medium" | "High",
        "confidenceScore": <number between 0 and 100>,
        "analysisSummary": "<A 3-4 sentence paragraph explaining the reasoning>",
        "redFlags": ["<list of any suspicious details or inconsistencies>"]
      }
      
      Respond with ONLY the JSON object, without any markdown formatting blocks like \`\`\`json.
    `;

    try {
      this.logger.debug('Generating risk analysis...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      
      // Clean up markdown if the AI includes it despite instructions
      if (text.startsWith('\`\`\`json')) {
        text = text.replace(/^\`\`\`json/g, '').replace(/\`\`\`$/g, '').trim();
      } else if (text.startsWith('\`\`\`')) {
        text = text.replace(/^\`\`\`/g, '').replace(/\`\`\`$/g, '').trim();
      }

      return JSON.parse(text);
    } catch (error) {
      this.logger.error('Error generating AI risk analysis:', error);
      throw new InternalServerErrorException('Failed to generate risk analysis from AI.');
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
    if (!this.model) {
      throw new InternalServerErrorException('AI Model is not configured.');
    }

    const prompt = `
      You are an advanced Agricultural Data Scientist AI.
      Analyze the "Monitoring Cycle" of the following farm based on its historical satellite and weather data.
      
      Farm Info: ${JSON.stringify(farmData, null, 2)}
      Historical NDVI (Vegetation Index): ${JSON.stringify(historicalNdvi, null, 2)}
      Historical Weather: ${JSON.stringify(historicalWeather, null, 2)}
      
      Please provide a comprehensive analysis including:
      1. Current Growth Stage (e.g., Germination, Vegetative, Flowering, Maturity).
      2. Health Trend (Are things improving or declining?).
      3. Anomaly Detection (Any weird drops in NDVI not explained by weather?).
      4. Estimated Days to Harvest.
      5. Marketability Insight (How can this farm's data be packaged for insurance investors or food buyers?).
      
      Format the response as a valid JSON object:
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
      
      Respond ONLY with the JSON object, no markdown formatting.
    `;

    try {
      this.logger.debug('Analyzing monitoring cycle for farm...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      
      if (text.startsWith('```json')) {
        text = text.replace(/^```json/g, '').replace(/```$/g, '').trim();
      } else if (text.startsWith('```')) {
        text = text.replace(/^```/g, '').replace(/```$/g, '').trim();
      }

      return JSON.parse(text);
    } catch (error) {
      this.logger.error('Error analyzing monitoring cycle:', error);
      throw new InternalServerErrorException('Failed to generate cycle analysis from AI.');
    }
  }
}
