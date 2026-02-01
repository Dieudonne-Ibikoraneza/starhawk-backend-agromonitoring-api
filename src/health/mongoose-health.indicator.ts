import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MongooseHealthIndicator extends HealthIndicator {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isHealthy = this.connection.readyState === 1;
    const result = this.getStatus(key, isHealthy, {
      state: this.getStateString(this.connection.readyState),
    });

    if (isHealthy) {
      return result;
    }
    throw new HealthCheckError('MongoDB check failed', result);
  }

  private getStateString(state: number): string {
    const states: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[state] || 'unknown';
  }
}

