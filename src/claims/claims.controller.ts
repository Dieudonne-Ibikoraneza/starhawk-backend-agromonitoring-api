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
  Delete,
  Query,
  UsePipes,
  ValidationPipe,
  BadRequestException,
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
import { ClaimsService } from './claims.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../users/enums/role.enum';
import { CreateClaimDto } from './dto/create-claim.dto';
import { UpdateClaimAssessmentDto } from './dto/update-claim-assessment.dto';
import { UuidValidationPipe } from '../common/pipes/uuid-validation.pipe';
import { PdfType } from '../assessments/dto/upload-drone-analysis.dto';

@ApiTags('Claims')
@ApiBearerAuth()
@Controller('claims')
@UseGuards(JwtAuthGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.FARMER)
  @ApiOperation({ summary: 'File a claim (Farmer only)' })
  @ApiResponse({ status: 201 })
  async fileClaim(@CurrentUser() user: any, @Body() createDto: CreateClaimDto) {
    return this.claimsService.fileClaim(user.userId, createDto);
  }

  @Put(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Assign assessor to claim (Insurer only)' })
  @ApiResponse({ status: 200 })
  async assignAssessor(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body('assessorId') assessorId: string,
  ) {
    return this.claimsService.assignAssessor(user.userId, id, assessorId);
  }

  @Put(':id/assessment')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Update claim assessment (Assessor only)' })
  @ApiResponse({ status: 200 })
  async updateAssessment(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body() updateDto: UpdateClaimAssessmentDto,
  ) {
    return this.claimsService.updateClaimAssessment(
      user.userId,
      id,
      updateDto,
    );
  }

  @Post(':id/submit-assessment')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Submit claim assessment (Assessor only)' })
  @ApiResponse({ status: 200 })
  async submitAssessment(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
  ) {
    return this.claimsService.submitClaimAssessment(user.userId, id);
  }

  @Put(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Approve claim (Insurer only)' })
  @ApiResponse({ status: 200 })
  async approveClaim(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body('payoutAmount') payoutAmount: number,
  ) {
    return this.claimsService.approveClaim(user.userId, id, payoutAmount);
  }

  @Put(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.INSURER)
  @ApiOperation({ summary: 'Reject claim (Insurer only)' })
  @ApiResponse({ status: 200 })
  async rejectClaim(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Body('rejectionReason') rejectionReason: string,
  ) {
    return this.claimsService.rejectClaim(user.userId, id, rejectionReason);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get claim by ID' })
  @ApiResponse({ status: 200 })
  async getClaim(@Param('id', UuidValidationPipe) id: string) {
    return this.claimsService.getClaim(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get claims (role-based)' })
  @ApiResponse({ status: 200 })
  async getClaims(@CurrentUser() user: any) {
    if (user.role === Role.FARMER) {
      return this.claimsService.getFarmerClaims(user.userId);
    } else if (user.role === Role.ASSESSOR) {
      return this.claimsService.getAssessorClaims(user.userId);
    } else if (user.role === Role.INSURER) {
      return this.claimsService.getInsurerClaims(user.userId);
    } else if (user.role === Role.ADMIN) {
      return this.claimsService.getAllClaims();
    }
    return [];
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
  @ApiOperation({ summary: 'Upload drone analysis PDF for a claim (Assessor only)' })
  @ApiResponse({ status: 200 })
  @ApiQuery({ name: 'pdfType', enum: PdfType, required: true, description: 'Type of PDF being uploaded' })
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
    return this.claimsService.uploadDroneAnalysis(
      user.userId,
      id,
      file,
      pdfType,
    );
  }

  @Get(':id/pdfs')
  @ApiOperation({ summary: 'Get all uploaded PDFs for a claim' })
  @ApiResponse({ status: 200, type: [Object] })
  async getUploadedPdfs(@Param('id', UuidValidationPipe) id: string) {
    return this.claimsService.getUploadedPdfs(id);
  }

  @Delete(':id/pdfs/:pdfType')
  @UseGuards(RolesGuard)
  @Roles(Role.ASSESSOR)
  @ApiOperation({ summary: 'Delete a specific PDF from a claim (Assessor only)' })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: 'pdfType', enum: PdfType })
  async deletePdf(
    @CurrentUser() user: any,
    @Param('id', UuidValidationPipe) id: string,
    @Param('pdfType') pdfType: PdfType,
  ) {
    return this.claimsService.deletePdf(
      user.userId,
      id,
      pdfType,
    );
  }
}

