import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Types } from 'mongoose';
import { MonitoringRepository } from './monitoring.repository';
import { AlertsRepository } from './alerts.repository';
import { PoliciesRepository } from '../policies/policies.repository';
import { FarmsRepository } from '../farms/farms.repository';
import { EosdaService } from '../eosda/eosda.service';
import { EmailService } from '../email/email.service';
import { UsersRepository } from '../users/users.repository';
import { AlertType, AlertSeverity } from './schemas/alert.schema';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private monitoringRepository: MonitoringRepository,
    private alertsRepository: AlertsRepository,
    private policiesRepository: PoliciesRepository,
    private farmsRepository: FarmsRepository,
    private eosdaService: EosdaService,
    private emailService: EmailService,
    private usersRepository: UsersRepository,
  ) {}

  // Run daily at 6 AM
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async monitorFarms() {
    this.logger.log('Starting daily farm monitoring...');

    // Get all active policies
    const activePolicies = await this.policiesRepository.findAll({
      status: 'ACTIVE',
    });

    for (const policy of activePolicies) {
      try {
        await this.monitorFarm(policy);
      } catch (error) {
        this.logger.error(
          `Failed to monitor farm ${policy.farmId}: ${error.message}`,
        );
      }
    }

    this.logger.log('Daily farm monitoring completed');
  }

  private async monitorFarm(policy: any) {
    const farm = await this.farmsRepository.findById(policy.farmId.toString());
    if (!farm || !farm.eosdaFieldId) {
      return; // Skip if farm not found or not linked to EOSDA
    }

    // Get current NDVI
    let currentNdvi: number | null = null;
    try {
      const stats = await this.eosdaService.statistics.getNDVITimeSeries({
        fieldId: farm.eosdaFieldId,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      });

      const ndviValues = stats.indices.NDVI || [];
      if (ndviValues.length > 0) {
        currentNdvi =
          ndviValues.reduce((sum, d) => sum + d.value, 0) / ndviValues.length;
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch NDVI for farm ${farm._id}: ${error.message}`);
    }

    // Get weather forecast
    const weatherAlerts: string[] = [];
    try {
      // Use eosdaFieldId if available (preferred method)
      if (farm.eosdaFieldId) {
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 7); // 7 days ahead

        const forecast = await this.eosdaService.weather.getForecast({
          fieldId: farm.eosdaFieldId,
          dateStart: today.toISOString().split('T')[0],
          dateEnd: endDate.toISOString().split('T')[0],
        });

        // Check for severe weather
        // WeatherForecastResponse has 'forecast' property, not 'data'
        if (forecast.forecast && Array.isArray(forecast.forecast)) {
          forecast.forecast.forEach((weather) => {
            if (weather.rainfall && weather.rainfall > 100) {
              weatherAlerts.push(
                `Heavy rainfall warning: ${weather.rainfall}mm on ${weather.date}`,
              );
            }
            // WeatherForecastDataPoint has temperature_min and temperature_max as direct properties
            if (weather.temperature_max > 35 || weather.temperature_min < 5) {
              weatherAlerts.push(
                `Extreme temperature: Max ${weather.temperature_max}°C, Min ${weather.temperature_min}°C on ${weather.date}`,
              );
            }
          });
        }
      } else if (farm.location) {
        // Legacy method is deprecated and throws an error, so skip it
        this.logger.warn(
          `Farm ${farm._id} has location but no eosdaFieldId. Weather forecast requires EOSDA field registration.`,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch weather for farm ${farm._id}: ${error.message}`);
    }

    // Calculate NDVI trend (comparing with previous record)
    let ndviTrend = 0;
    const farmId = farm._id as any;
    const policyId = policy._id as any;
    const previousRecord =
      await this.monitoringRepository.findLatestByFarmId(farmId.toString());
    if (previousRecord && currentNdvi !== null) {
      const change = currentNdvi - (previousRecord.currentNdvi || 0);
      if (change < -0.1) {
        ndviTrend = -1; // Declining
      } else if (change > 0.1) {
        ndviTrend = 1; // Improving
      }
    }

    // Check thresholds
    const thresholdsExceeded =
      (currentNdvi !== null && currentNdvi < 0.3) ||
      weatherAlerts.length > 0 ||
      ndviTrend === -1;

    // Create monitoring record
    const record = await this.monitoringRepository.create({
      farmId: farmId as Types.ObjectId,
      policyId: policyId as Types.ObjectId,
      currentNdvi: currentNdvi || undefined,
      ndviTrend,
      weatherAlerts,
      thresholdsExceeded,
      alertSent: false,
    });

    // Generate alerts if thresholds exceeded
    if (thresholdsExceeded && !previousRecord?.alertSent) {
      await this.generateAlerts(farm, policy, record, currentNdvi, weatherAlerts);
    }
  }

  private async generateAlerts(
    farm: any,
    policy: any,
    record: any,
    currentNdvi: number | null,
    weatherAlerts: string[],
  ) {
    const farmer = await this.usersRepository.findById(
      policy.farmerId.toString(),
    );
    if (!farmer) {
      return;
    }

    const alerts: Array<{ type: AlertType; severity: AlertSeverity; message: string }> = [];

    // NDVI drop alert
    if (currentNdvi !== null && currentNdvi < 0.3) {
      alerts.push({
        type: AlertType.NDVI_DROP,
        severity: AlertSeverity.HIGH,
        message: `NDVI has dropped to ${currentNdvi.toFixed(2)} on farm ${farm.name}. This may indicate crop stress or damage.`,
      });
    }

    // Weather alerts
    if (weatherAlerts.length > 0) {
      alerts.push({
        type: AlertType.WEATHER_WARNING,
        severity: AlertSeverity.MEDIUM,
        message: `Weather warnings for farm ${farm.name}: ${weatherAlerts.join('; ')}`,
      });
    }

    // Threshold exceeded alert
    alerts.push({
      type: AlertType.THRESHOLD_EXCEEDED,
      severity: AlertSeverity.MEDIUM,
      message: `Monitoring thresholds exceeded for farm ${farm.name}. Please review farm condition.`,
    });

    // Create alert records and send emails
    for (const alertData of alerts) {
      const alert = await this.alertsRepository.create({
        farmId: farm._id,
        policyId: policy._id,
        ...alertData,
      });

      // Send email to farmer
      try {
        await this.emailService.sendWelcomeEmail(
          farmer.email,
          farmer.firstName,
          farmer.phoneNumber,
          '', // No password needed for alert emails
        );
        // Note: Email template should be customized for alerts
      } catch (error) {
        this.logger.error(`Failed to send alert email: ${error.message}`);
      }
    }

    // Mark record as alert sent
    record.alertSent = true;
    await record.save();
  }

  async getMonitoringData(farmId: string) {
    return this.monitoringRepository.findByFarmId(farmId);
  }

  async getAlerts(farmId?: string) {
    if (farmId) {
      return this.alertsRepository.findByFarmId(farmId);
    }
    return this.alertsRepository.findUnread();
  }

  async markAlertAsRead(alertId: string) {
    return this.alertsRepository.markAsRead(alertId);
  }
}

