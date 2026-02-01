import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { MongooseHealthIndicator } from './mongoose-health.indicator';
import { platform } from 'os';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private mongoose: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    // Get platform-specific root path
    const rootPath = platform() === 'win32' 
      ? process.cwd() // Use current working directory on Windows
      : '/'; // Use root on Unix-like systems

    return this.health.check([
      () => this.mongoose.isHealthy('mongodb'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
      () =>
        this.disk.checkStorage('storage', {
          path: rootPath,
          thresholdPercent: 0.9,
        }),
    ]);
  }
}

