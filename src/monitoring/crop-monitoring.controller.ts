import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Delete,
  Query,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CropMonitoringService } from './crop-monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';
import { ValidationPipe } from '@nestjs/common';
import { StartMonitoringDto } from './dto/start-monitoring.dto';
import { PdfType } from '../assessments/dto/upload-drone-analysis.dto';

@ApiTags('Crop Monitoring')
@ApiBearerAuth()
@Controller('crop-monitoring')
@UseGuards(JwtAuthGuard)
export class CropMonitoringController {
  constructor(private readonly cropMonitoringService: CropMonitoringService) {}

  @Post('start')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Start a new crop monitoring cycle' })
  @ApiResponse({ status: 201 })
  async startMonitoring(@CurrentUser() user: any, @Body() body: StartMonitoringDto) {
    // Manual validation as fallback
    console.log(' Raw request body received:', JSON.stringify(body, null, 2));
    console.log(' Parsed body:', body);

    if (!body || !body.policyId) {
      console.log(' Validation failed - body:', body);
      throw new BadRequestException('Policy ID is required');
    }

    console.log(' Manual validation - policyId:', body.policyId);
    return this.cropMonitoringService.startMonitoring(user.userId, body.policyId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Update crop monitoring data (Assessor only)' })
  @ApiResponse({ status: 200 })
  async updateMonitoring(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body()
    updateData: {
      observations?: string[];
      notes?: string;
      ndviData?: object;
      photoUrls?: string[];
    },
  ) {
    return this.cropMonitoringService.updateMonitoring(user.userId, id, updateData);
  }

  @Post(':id/generate-report')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({
    summary: 'Generate crop monitoring report (Assessor only)',
  })
  @ApiResponse({ status: 200 })
  async generateReport(@CurrentUser() user: any, @Param('id', UuidValidationPipe) id: string) {
    return this.cropMonitoringService.generateMonitoringReport(user.userId, id);
  }

  @Get()
  @ApiOperation({ summary: 'List crop monitoring records (role-based, parents only without nested cycles)' })
  @ApiResponse({ status: 200, description: 'Role-based list of crop monitoring parents' })
  async getMonitoringTasks(@CurrentUser() user: any) {
    // ASSESSOR: See their monitoring tasks
    if (user.role === Role.ASSESSOR) {
      return this.cropMonitoringService.getAssessorMonitoringTasks(user.userId);
    }
    // INSURER: See monitoring for their policies
    if (user.role === Role.INSURER) {
      return this.cropMonitoringService.getInsurerMonitoringTasks(user.userId);
    }
    // ADMIN: See all (via specialized endpoint records/all, or maybe just return [] here)
    return [];
  }

  @Get('records/all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all crop monitoring records (Admin only, parents only without nested cycles)' })
  @ApiResponse({ status: 200 })
  async getAllMonitoringRecordsAdmin() {
    return this.cropMonitoringService.getAllMonitoringRecordsForAdmin();
  }

  @Get('policy/:policyId')
  @ApiOperation({ summary: 'Get all monitoring records for a policy' })
  @ApiResponse({ status: 200 })
  async getPolicyMonitoring(@Param('policyId', UuidValidationPipe) policyId: string) {
    return this.cropMonitoringService.getPolicyMonitoringRecords(policyId);
  }

  @Post(':id/upload-drone-pdf')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/drone-analysis',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload drone analysis PDF (Assessor only)' })
  @ApiResponse({ status: 200 })
  @ApiQuery({
    name: 'pdfType',
    enum: PdfType,
    required: true,
    description: 'Type of PDF being uploaded',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadDronePdf(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('pdfType') pdfType: PdfType,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.cropMonitoringService.uploadDroneAnalysis(user.userId, id, file, pdfType);
  }

  @Get(':id/pdfs')
  @ApiOperation({ summary: 'Get all uploaded PDFs for a monitoring cycle' })
  @ApiResponse({ status: 200, type: [Object] })
  async getUploadedPdfs(@Param('id', UuidValidationPipe) id: string) {
    return this.cropMonitoringService.getUploadedPdfs(id);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INSURER, Role.ASSESSOR)
  @ApiOperation({ summary: 'Get crop monitoring by ID (including all monitoring cycles inside the response)' })
  @ApiResponse({ status: 200, description: 'Crop monitoring record details with all nested monitoring cycles' })
  async getMonitoringByIdAdmin(@Param('id', UuidValidationPipe) id: string) {
    return this.cropMonitoringService.getMonitoringByIdForAdmin(id);
  }

  @Delete(':id/pdfs/:pdfType')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Delete a specific PDF from a monitoring cycle (Assessor only)' })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: 'pdfType', enum: PdfType })
  async deletePdf(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Param('pdfType') pdfType: PdfType,
  ) {
    return this.cropMonitoringService.deletePdf(user.userId, id, pdfType);
  }
}
