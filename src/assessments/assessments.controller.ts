import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { AssignAssessorDto } from './dto/assign-assessor.dto';
import { RejectAssessmentDto } from './dto/reject-assessment.dto';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';

@ApiTags('Assessments')
@ApiBearerAuth()
@Controller('assessments')
@UseGuards(JwtAuthGuard)
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Create assessment (Insurer only)' })
  @ApiResponse({ status: 201 })
  async create(
    @CurrentUser() user: any,
    @Body() createDto: CreateAssessmentDto,
  ) {
    return this.assessmentsService.createAssessment(
      user.userId,
      createDto,
    );
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Update assessment (Assessor only)' })
  @ApiResponse({ status: 200 })
  async update(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body() updateDto: UpdateAssessmentDto,
  ) {
    return this.assessmentsService.updateAssessment(
      user.userId,
      id,
      updateDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get assessments (role-based)' })
  @ApiResponse({ status: 200 })
  async getAssessments(@CurrentUser() user: any) {
    // Log user info for debugging
    console.log('GET /assessments - User:', {
      userId: user?.userId,
      role: user?.role,
      roleType: typeof user?.role,
    });

    // ASSESSOR: See assessments assigned to them
    if (user?.role === Role.ASSESSOR || user?.role === 'ASSESSOR') {
      console.log('Fetching assessor assessments for:', user.userId);
      return this.assessmentsService.getAssessorAssessments(user.userId);
    }
    // INSURER: See assessments they created
    else if (user?.role === Role.INSURER || user?.role === 'INSURER') {
      console.log('Fetching insurer assessments for:', user.userId);
      return this.assessmentsService.getInsurerAssessments(user.userId);
    }
    // ADMIN: See all assessments
    else if (user?.role === Role.ADMIN || user?.role === 'ADMIN') {
      console.log('Fetching all assessments (ADMIN)');
      return this.assessmentsService.getAllAssessments();
    }
    // Default: Return empty array
    console.warn('No matching role found, returning empty array. User role:', user?.role);
    return [];
  }

  @Get('farmers/list')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'List assigned farmers with their farms (Assessor only)' })
  @ApiResponse({ status: 200 })
  async listFarmersWithFarms(@CurrentUser() user: any) {
    return this.assessmentsService.getAllFarmersWithFarms(user.userId);
  }

  @Get('pending-farms')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all pending farms (Admin only)' })
  @ApiResponse({ status: 200 })
  async getPendingFarms() {
    return this.assessmentsService.getPendingFarms();
  }

  @Post('assign')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Assign assessor to a pending farm (Admin only)' })
  @ApiResponse({ status: 201 })
  async assignAssessor(@Body() assignDto: AssignAssessorDto) {
    return this.assessmentsService.assignAssessorToFarm(
      assignDto.farmId,
      assignDto.assessorId,
      assignDto.insurerId,
    );
  }

  @Post(':id/generate-report')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Generate full assessment report (Assessor only)' })
  @ApiResponse({ status: 200 })
  async generateReport(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
  ) {
    return this.assessmentsService.generateFullReport(user.userId, id);
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
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload drone analysis PDF (Assessor only)' })
  @ApiResponse({ status: 200 })
  async uploadDronePdf(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.assessmentsService.uploadDroneAnalysis(
      user.userId,
      id,
      file,
    );
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Approve assessment (Insurer only)' })
  @ApiResponse({ status: 200 })
  async approveAssessment(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
  ) {
    return this.assessmentsService.approveAssessment(user.userId, id);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Reject assessment (Insurer only)' })
  @ApiResponse({ status: 200 })
  async rejectAssessment(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body() rejectDto: RejectAssessmentDto,
  ) {
    return this.assessmentsService.rejectAssessment(
      user.userId,
      id,
      rejectDto.rejectionReason,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assessment by ID' })
  @ApiResponse({ status: 200 })
  async getAssessment(@Param('id', UuidValidationPipe) id: string) {
    return this.assessmentsService.getAssessment(id);
  }
}

