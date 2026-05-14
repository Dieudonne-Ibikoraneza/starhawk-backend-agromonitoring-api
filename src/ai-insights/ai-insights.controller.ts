import { Controller, Post, Body, Get, Param, Query, UseGuards, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { AiInsightsService } from './ai-insights.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming path based on common structure

@Controller('ai-insights')
export class AiInsightsController {
  constructor(private readonly aiInsightsService: AiInsightsService) {}

  @Post('farmer-suggestions')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard) // Uncomment once fully integrated with frontend auth
  async getFarmerSuggestions(
    @Body() body: { farmData: any; weatherData: any; ndviData: any }
  ) {
    const insights = await this.aiInsightsService.getFarmerSuggestions(
      body.farmData, 
      body.weatherData, 
      body.ndviData
    );
    
    return { 
      success: true, 
      data: insights 
    };
  }

  @Post('risk-analysis')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard)
  async getRiskAnalysis(
    @Body() body: { claimData: any; farmData: any; satelliteData: any; role?: string }
  ) {
    const analysis = await this.aiInsightsService.getRiskAnalysis(
      body.claimData, 
      body.farmData, 
      body.satelliteData,
      body.role
    );
    
    return { 
      success: true, 
      data: analysis 
    };
  }

  @Post('assessment-summary')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard)
  async getAssessmentSummary(
    @Body() body: { farmData: any; fieldNotes: string }
  ) {
    const summary = await this.aiInsightsService.getAssessmentSummary(
      body.farmData, 
      body.fieldNotes
    );
    
    return { 
      success: true, 
      data: summary 
    };
  }

  @Post('monitoring-cycle')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard)
  async getMonitoringCycle(
    @Body() body: { farmData: any; historicalNdvi: any[]; historicalWeather: any[] }
  ) {
    const cycleData = await this.aiInsightsService.analyzeMonitoringCycle(
      body.farmData, 
      body.historicalNdvi, 
      body.historicalWeather
    );
    
    return { 
      success: true, 
      data: cycleData 
    };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async followUpChat(
    @Body() body: { insightId: string; message: string }
  ) {
    const updatedInsight = await this.aiInsightsService.followUpChat(
      body.insightId, 
      body.message
    );
    
    return { 
      success: true, 
      data: updatedInsight 
    };
  }

  @Get('portfolio-insight')
  async getPortfolioInsight(
    @Query('refresh') refresh?: string,
    @Query('insurerId') insurerId?: string
  ) {
    const forceRefresh = refresh === 'true';
    const insight = await this.aiInsightsService.getPortfolioInsight(forceRefresh, insurerId);
    return {
      success: true,
      data: insight
    };
  }

  @Get(':contextId/:type')
  async getInsight(
    @Param('contextId') contextId: string,
    @Param('type') type: string,
    @Query('role') role?: string
  ) {
    const insight = await this.aiInsightsService.findByContext(contextId, type, role);
    if (!insight) {
      throw new NotFoundException('Insight not found');
    }
    return {
      success: true,
      data: insight
    };
  }
}
