import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { FarmsService } from './farms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { CreateFarmDto } from './dto/create-farm.dto';
import { CreateFarmSimpleDto } from './dto/create-farm-simple.dto';
import { UploadFarmKmlDto } from './dto/upload-farm-kml.dto';
import { FarmResponseDto } from './dto/farm-response.dto';
import { CreateInsuranceRequestDto } from './dto/create-insurance-request.dto';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('Farms')
@ApiBearerAuth()
@Controller('farms')
@UseGuards(JwtAuthGuard)
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Post('register')
  @UseGuards(RolesGuard)
  @Roles(Role.FARMER)
  @ApiOperation({ summary: 'Register a new farm (Farmer only) - provides crop type and sowing date' })
  @ApiResponse({ status: 201, type: FarmResponseDto })
  async register(
    @CurrentUser() user: any,
    @Body() createFarmDto: CreateFarmSimpleDto,
  ): Promise<FarmResponseDto> {
    return this.farmsService.createSimple(user.userId, createFarmDto);
  }

  @Post(':farmId/upload-kml')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/kml',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 1048576, // 1MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'application/vnd.google-earth.kml+xml',
          'application/xml',
          'text/xml',
          'text/plain',
        ];
        const allowedExtensions = ['.kml'];
        
        const hasValidMimeType = allowedMimeTypes.includes(file.mimetype);
        const hasValidExtension = allowedExtensions.some(ext => 
          file.originalname.toLowerCase().endsWith(ext)
        );

        if (hasValidMimeType || hasValidExtension) {
          cb(null, true);
        } else {
          cb(new Error('Only KML files (.kml) are allowed'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload KML file for a farm (Assessor only) - completes farm registration' })
  @ApiResponse({ status: 200, type: FarmResponseDto })
  async uploadKMLForFarm(
    @CurrentUser() user: any,
    @Param('farmId', UuidValidationPipe) farmId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadFarmKmlDto,
  ): Promise<FarmResponseDto> {
    if (!file) {
      throw new BadRequestException('No KML file uploaded');
    }

    const fs = require('fs');
    const fileBuffer = fs.readFileSync(file.path);

    try {
      const farm = await this.farmsService.uploadKMLForFarm(
        user.userId,
        farmId,
        uploadDto.name,
        fileBuffer,
      );

      // Clean up uploaded file
      fs.unlinkSync(file.path);

      return farm;
    } catch (error) {
      // Clean up uploaded file on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'List farms' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200 })
  async findAll(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(10), ParseIntPipe) size: number,
  ) {
    // Farmers see only their farms, admins see all
    const farmerId = user.role === Role.ADMIN ? undefined : user.userId;
    return this.farmsService.findAll(farmerId, page, size);
  }

  // IMPORTANT: Specific routes must come BEFORE parameterized routes (:id)
  // Otherwise /farms/insurance-requests will match /farms/:id

  @Get('insurance-requests')
  @ApiOperation({ summary: 'Get insurance requests' })
  @ApiResponse({ status: 200 })
  async getInsuranceRequests(@CurrentUser() user: any) {
    const farmerId = user.role === Role.FARMER ? user.userId : undefined;
    const insurerId = user.role === Role.INSURER ? user.userId : undefined;
    return this.farmsService.getInsuranceRequests(farmerId, insurerId);
  }

  @Post('insurance-requests')
  @ApiOperation({ summary: 'Create insurance request for a farm' })
  @ApiResponse({ status: 201 })
  async createInsuranceRequest(
    @CurrentUser() user: any,
    @Body() createDto: CreateInsuranceRequestDto,
  ) {
    return this.farmsService.createInsuranceRequest(
      user.userId,
      createDto.farmId,
      createDto.notes,
    );
  }

  // Farm Analytics Endpoints - Must come before :id route
  // These endpoints allow any authenticated user to view analytics data for a farm

  @Get(':id/weather/forecast')
  @ApiOperation({ summary: 'Get weather forecast for a farm' })
  @ApiQuery({ name: 'dateStart', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateEnd', required: true, description: 'End date (YYYY-MM-DD), max 14 days ahead' })
  @ApiResponse({ status: 200, description: 'Weather forecast data' })
  async getWeatherForecast(
    @Param('id', UuidValidationPipe) id: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
  ) {
    return this.farmsService.getWeatherForecast(id, dateStart, dateEnd);
  }

  @Get(':id/weather/historical')
  @ApiOperation({ summary: 'Get historical weather data for a farm' })
  @ApiQuery({ name: 'dateStart', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateEnd', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Historical weather data' })
  async getHistoricalWeather(
    @Param('id', UuidValidationPipe) id: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
  ) {
    return this.farmsService.getHistoricalWeather(id, dateStart, dateEnd);
  }

  @Get(':id/weather/accumulated')
  @ApiOperation({ summary: 'Get accumulated weather data (GDD, seasonal analysis) for a farm' })
  @ApiQuery({ name: 'dateStart', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateEnd', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'sumOfActiveTemperatures', required: false, description: 'Base temperature for GDD (default: 10)' })
  @ApiQuery({ name: 'provider', required: false, description: 'Weather provider (default: weather-online)' })
  @ApiResponse({ status: 200, description: 'Accumulated weather statistics' })
  async getAccumulatedWeather(
    @Param('id', UuidValidationPipe) id: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
    @Query('sumOfActiveTemperatures') sumOfActiveTemperatures?: number,
    @Query('provider') provider?: string,
  ) {
    return this.farmsService.getAccumulatedWeather(
      id,
      dateStart,
      dateEnd,
      sumOfActiveTemperatures,
      provider,
    );
  }

  @Get(':id/indices/statistics')
  @ApiOperation({ summary: 'Get vegetation indices statistics (NDVI, MSAVI, NDMI, EVI) for a farm' })
  @ApiQuery({ name: 'dateStart', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateEnd', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'indices', required: false, description: 'Comma-separated list of indices (NDVI,MSAVI,NDMI,EVI)' })
  @ApiQuery({ name: 'sensors', required: false, description: 'Comma-separated list of sensors (sentinel2,sentinel1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max data points (default: 100)' })
  @ApiQuery({ name: 'excludeCoverPixels', required: false, description: 'Exclude clouds (default: true)' })
  @ApiQuery({ name: 'cloudMaskingLevel', required: false, enum: ['best', 'normal', 'basic'], description: 'Cloud masking level (default: best)' })
  @ApiResponse({ status: 200, description: 'Vegetation indices statistics' })
  async getIndicesStatistics(
    @Param('id', UuidValidationPipe) id: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
    @Query('indices') indices?: string,
    @Query('sensors') sensors?: string,
    @Query('limit') limit?: number,
    @Query('excludeCoverPixels') excludeCoverPixels?: string | boolean,
    @Query('cloudMaskingLevel') cloudMaskingLevel?: 'best' | 'normal' | 'basic',
  ) {
    const indicesArray = indices ? indices.split(',') : undefined;
    const sensorsArray = sensors
      ? (sensors.split(',') as ('sentinel2' | 'sentinel1')[])
      : undefined;
    
    // Parse boolean query parameter (can be string 'true'/'false' or boolean)
    const excludeCoverPixelsParsed = excludeCoverPixels === undefined 
      ? undefined 
      : excludeCoverPixels === true || excludeCoverPixels === 'true' || excludeCoverPixels === '1';
    
    return this.farmsService.getIndicesStatistics(
      id,
      dateStart,
      dateEnd,
      indicesArray,
      sensorsArray,
      limit,
      excludeCoverPixelsParsed,
      cloudMaskingLevel,
    );
  }

  @Get(':id/indices/ndvi')
  @ApiOperation({ summary: 'Get NDVI time series for a farm' })
  @ApiQuery({ name: 'dateStart', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateEnd', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'NDVI time series data' })
  async getNDVITimeSeries(
    @Param('id', UuidValidationPipe) id: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
  ) {
    return this.farmsService.getNDVITimeSeries(id, dateStart, dateEnd);
  }

  @Get(':id/indices/trend')
  @ApiOperation({ summary: 'Get field trend (NDVI or other index over time) for a farm' })
  @ApiQuery({ name: 'dateStart', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateEnd', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'index', required: false, enum: ['NDVI', 'MSAVI', 'NDMI', 'EVI'], description: 'Index type (default: NDVI)' })
  @ApiQuery({ name: 'dataSource', required: false, enum: ['S2', 'S1'], description: 'Data source (default: S2)' })
  @ApiResponse({ status: 200, description: 'Field trend data' })
  async getFieldTrend(
    @Param('id', UuidValidationPipe) id: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
    @Query('index') index?: 'NDVI' | 'MSAVI' | 'NDMI' | 'EVI',
    @Query('dataSource') dataSource?: 'S2' | 'S1',
  ) {
    return this.farmsService.getFieldTrend(id, dateStart, dateEnd, index, dataSource);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get farm by ID' })
  @ApiResponse({ status: 200, type: FarmResponseDto })
  async findById(
    @Param('id', UuidValidationPipe) id: string,
  ): Promise<FarmResponseDto> {
    return this.farmsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update farm' })
  @ApiResponse({ status: 200, type: FarmResponseDto })
  async update(
    @Param('id', UuidValidationPipe) id: string,
    @Body() updateData: Partial<CreateFarmDto>,
  ): Promise<FarmResponseDto> {
    return this.farmsService.update(id, updateData);
  }
}

