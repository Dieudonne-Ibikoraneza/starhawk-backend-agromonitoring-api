import { Injectable } from '@nestjs/common';
import { CropType } from '../../farms/enums/crop-type.enum';

// Interfaces for risk scoring
export interface WeatherDataPoint {
  date: string;
  rainfall: number;
  temperature: {
    min: number;
    max: number;
    average: number;
  };
}

export interface NDVIData {
  date: string;
  value: number;
}

@Injectable()
export class RiskScoringService {
  // Risk factors by crop type (0-100 scale)
  private readonly cropRiskFactors: Record<CropType, number> = {
    [CropType.MAIZE]: 60,
    [CropType.BEANS]: 50,
    [CropType.RICE]: 70,
    [CropType.WHEAT]: 55,
    [CropType.SORGHUM]: 45,
    [CropType.POTATOES]: 65,
    [CropType.CASSAVA]: 40,
    [CropType.BANANAS]: 55,
    [CropType.COFFEE]: 50,
    [CropType.TEA]: 45,
    [CropType.OTHER]: 60,
  };

  calculateRiskScore(
    cropType: CropType,
    farmArea: number, // in hectares
    weatherHistory: WeatherDataPoint[],
    ndviHistory: NDVIData[],
  ): number {
    // Crop type risk (30% weight)
    const cropRisk = this.cropRiskFactors[cropType] || 60;

    // Size risk (20% weight) - larger farms = higher risk
    const sizeRisk = Math.min((farmArea / 10) * 10, 100);

    // Weather risk (30% weight)
    const weatherRisk = this.calculateWeatherRisk(weatherHistory);

    // NDVI trend risk (20% weight)
    const ndviRisk = this.calculateNDVIRisk(ndviHistory);

    // Weighted formula
    const riskScore =
      cropRisk * 0.3 + sizeRisk * 0.2 + weatherRisk * 0.3 + ndviRisk * 0.2;

    // Ensure score is between 0-100
    return Math.max(0, Math.min(100, Math.round(riskScore)));
  }

  private calculateWeatherRisk(weatherHistory: WeatherDataPoint[]): number {
    if (!weatherHistory || weatherHistory.length === 0) {
      return 50; // Default medium risk if no data
    }

    let riskScore = 0;
    let droughtCount = 0;
    let floodCount = 0;

    weatherHistory.forEach((weather) => {
      // Detect drought (low rainfall)
      if (weather.rainfall < 50) {
        droughtCount++;
      }

      // Detect flood risk (high rainfall)
      if (weather.rainfall > 200) {
        floodCount++;
      }

      // Extreme temperatures
      if (
        weather.temperature.max > 35 ||
        weather.temperature.min < 5
      ) {
        riskScore += 5;
      }
    });

    // Drought frequency
    const droughtFrequency = droughtCount / weatherHistory.length;
    riskScore += droughtFrequency * 30;

    // Flood frequency
    const floodFrequency = floodCount / weatherHistory.length;
    riskScore += floodFrequency * 25;

    return Math.min(100, riskScore);
  }

  private calculateNDVIRisk(ndviHistory: NDVIData[]): number {
    if (!ndviHistory || ndviHistory.length < 2) {
      return 50; // Default medium risk if insufficient data
    }

    // Calculate trend (simple linear regression)
    const values = ndviHistory.map((d) => d.value);
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    values.forEach((value, index) => {
      sumX += index;
      sumY += value;
      sumXY += index * value;
      sumX2 += index * index;
    });

    // Slope calculation
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Negative slope indicates declining NDVI = higher risk
    if (slope < -0.01) {
      // Declining trend
      return Math.min(100, 50 + Math.abs(slope) * 1000);
    } else if (slope > 0.01) {
      // Improving trend
      return Math.max(0, 50 - slope * 500);
    }

    // Stable trend
    return 50;
  }

  calculatePremium(riskScore: number, farmArea: number): number {
    // Base premium per hectare
    const basePremiumPerHectare = 50000; // RWF

    // Risk multiplier (0.5x to 2.0x based on risk score)
    const riskMultiplier = 0.5 + (riskScore / 100) * 1.5;

    // Calculate premium
    const premium = basePremiumPerHectare * farmArea * riskMultiplier;

    return Math.round(premium);
  }
}

