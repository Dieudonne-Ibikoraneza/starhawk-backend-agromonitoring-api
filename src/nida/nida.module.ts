import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import https from 'https';
import { NidaService } from './nida.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isNidaSslDisabled = configService.get<boolean>(
          'NIDA_DISABLE_SSL',
          true,
        );

        if (isNidaSslDisabled) {
          // Disable SSL verification for NIDA API
          const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
          });

          return {
            httpsAgent,
            timeout: 10000,
          };
        }

        return {
          timeout: 10000,
        };
      },
    }),
  ],
  providers: [NidaService],
  exports: [NidaService],
})
export class NidaModule {}

