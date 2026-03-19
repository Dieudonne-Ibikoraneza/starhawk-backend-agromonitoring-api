import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { FarmsRepository } from './farms.repository';
import { InsuranceRequestsRepository } from './insurance-requests.repository';
import { ShapefileParserService } from './services/shapefile-parser.service';
import { LocationService } from './services/location.service';
import { AgromonitoringService } from '../agromonitoring/agromonitoring.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { EmailService } from '../email/email.service';
import { UsersRepository } from '../users/users.repository';
import { Role } from '../users/enums/role.enum';
import { CreateFarmDto } from './dto/create-farm.dto';
import { CreateFarmSimpleDto } from './dto/create-farm-simple.dto';
import { FarmResponseDto } from './dto/farm-response.dto';
import { FarmStatus } from './enums/farm-status.enum';
import { InsuranceRequestStatus } from './enums/insurance-request-status.enum';

@Injectable()
export class FarmsService {
  private readonly logger = new Logger(FarmsService.name);

  constructor(
    private farmsRepository: FarmsRepository,
    private insuranceRequestsRepository: InsuranceRequestsRepository,
    private shapefileParser: ShapefileParserService,
    private locationService: LocationService,
    private agromonitoringService: AgromonitoringService,
    private assessmentsService: AssessmentsService,
    private emailService: EmailService,
    private usersRepository: UsersRepository,
  ) {}

  /**
   * Create a simple farm registration with only crop type and sowing date
   * This is called by farmers to register a farm without geometry
   * The farm will be in PENDING status until an assessor uploads the KML file
   */
  async createSimple(farmerId: string, createDto: CreateFarmSimpleDto): Promise<FarmResponseDto> {
    // Validate sowing date
    const sowingDate = new Date(createDto.sowingDate);
    if (isNaN(sowingDate.getTime())) {
      throw new BadRequestException('Invalid sowing date format');
    }

    // Validate sowing date is at least 14 days in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    const minSowingDate = new Date(today);
    minSowingDate.setDate(today.getDate() + 14); // 14 days from today

    if (sowingDate < minSowingDate) {
      throw new BadRequestException(
        `Sowing date must be at least 14 days in the future. Minimum date: ${minSowingDate.toISOString().split('T')[0]}`,
      );
    }

    // Create farm with minimal data
    const farmData = {
      farmerId: new Types.ObjectId(farmerId),
      cropType: createDto.cropType,
      sowingDate,
      status: FarmStatus.PENDING,
      // No name, boundary, location, or eosdaFieldId yet
    };

    const farm = await this.farmsRepository.create(farmData);

    this.logger.log(
      `✅ Farm registered (simple) - Farm ID: ${farm._id}, Status: PENDING, awaiting KML upload`,
    );

    // Notify all admins about new farm registration
    try {
      const farmer = await this.usersRepository.findById(farmerId);
      if (farmer) {
        const adminsResult = await this.usersRepository.findByRole(
          Role.ADMIN,
          0,
          100, // Get all admins
          'createdAt',
          'desc',
        );

        // Send notification to each admin
        for (const admin of adminsResult.items) {
          await this.emailService
            .sendFarmRegistrationNotification(
              admin.email,
              admin.firstName,
              farmer.firstName + ' ' + farmer.lastName,
              farmer.email,
              farmer.phoneNumber,
              createDto.cropType,
              createDto.sowingDate,
              (farm._id as any).toString(),
            )
            .catch(error => {
              this.logger.error(
                `Failed to send farm registration notification to admin ${admin.email}: ${error.message}`,
              );
            });
        }
      }
    } catch (error) {
      // Log but don't fail farm creation if notification fails
      this.logger.error(
        `Failed to send admin notifications for farm registration: ${error.message}`,
      );
    }

    return this.mapToFarmResponse(farm);
  }

  /**
   * Upload KML file for a farm by assessor
   * This completes the farm registration by adding geometry and creating EOSDA field
   */
  async uploadKMLForFarm(
    assessorId: string,
    farmId: string,
    name: string,
    kmlBuffer: Buffer,
  ): Promise<FarmResponseDto> {
    // Validate farm exists
    const farm = await this.farmsRepository.findById(farmId);
    if (!farm) {
      throw new NotFoundException('Farm', farmId);
    }

    // Validate farm is in PENDING status
    if (farm.status !== FarmStatus.PENDING) {
      throw new BadRequestException(
        `Farm is already ${farm.status}. Only farms with PENDING status can have KML uploaded.`,
      );
    }

    // Validate assessor is assigned to this specific farm
    const isAssigned = await this.assessmentsService.isAssessorAssignedToFarm(assessorId, farmId);

    if (!isAssigned) {
      throw new ForbiddenException('You are not assigned to assess this farm');
    }

    // Parse KML to get boundary
    const boundary = await this.shapefileParser.parseKML(kmlBuffer);

    // Calculate area and centroid
    const area = this.shapefileParser.calculateArea(boundary);
    const centroid = this.shapefileParser.calculateCentroid(boundary);
    const location = {
      type: 'Point' as const,
      coordinates: centroid,
    };

    // Create EOSDA field with geometry, crop type, and sowing date.
    // IMPORTANT: If EOSDA fails (e.g. requests limit exceeded), we still
    // proceed with updating the farm so that KML upload completes and
    // the farm moves out of PENDING status. EOSDA-dependent analytics
    // will later validate the presence of eosdaFieldId and fail gracefully.
    let eosdaFieldId: string | undefined;
    let eosdaArea: string | undefined;
    try {
      const eosdaField = await this.createEosdaField(
        name,
        boundary,
        farm.cropType,
        farm.sowingDate,
      );

      eosdaFieldId = eosdaField.id.toString();
      eosdaArea = String(eosdaField.area); // AGROmonitoring returns area directly in hectares

      this.logger.log(
        `✅ EOSDA field created successfully - Field ID: ${eosdaFieldId}, Area: ${eosdaArea} hectares`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to create EOSDA field: ${error.message}. Proceeding without EOSDA field ID; farm will still be updated with KML geometry.`,
      );
      // We intentionally do NOT throw here so that KML upload still
      // registers the farm and updates its geometry/status. Downstream
      // EOSDA features that require eosdaFieldId will perform their
      // own checks and return appropriate errors.
      eosdaFieldId = undefined;
      eosdaArea = undefined;
    }

    // Update farm with geometry, name, and EOSDA field ID
    const updateData = {
      name,
      boundary,
      location,
      area,
      eosdaFieldId,
      status: FarmStatus.REGISTERED,
    };

    const updatedFarm = await this.farmsRepository.update(farmId, updateData);

    if (!updatedFarm) {
      throw new NotFoundException('Farm', farmId);
    }

    this.logger.log(
      `✅ Farm updated with KML - Farm ID: ${updatedFarm._id}, Status: REGISTERED, EOSDA Field ID: ${eosdaFieldId}`,
    );

    return this.mapToFarmResponse(updatedFarm);
  }

  // OLD METHODS - DEPRECATED - Will be removed
  // These methods are kept for backward compatibility but should not be used
  // Use createSimple() and uploadKMLForFarm() instead

  async create(farmerId: string, createFarmDto: CreateFarmDto): Promise<FarmResponseDto> {
    // Validate geometry
    this.validateGeometry(createFarmDto.boundary);

    // Calculate area
    const area = this.shapefileParser.calculateArea(createFarmDto.boundary);

    // Ensure location matches boundary centroid
    const centroid = this.shapefileParser.calculateCentroid(createFarmDto.boundary);
    const location = {
      type: 'Point' as const,
      coordinates: centroid,
    };

    // Create EOSDA field FIRST - if this fails, don't create the farm
    let eosdaFieldId: string | undefined;
    let eosdaArea: string | undefined;
    try {
      const eosdaField = await this.createEosdaField(
        createFarmDto.name,
        createFarmDto.boundary,
        createFarmDto.cropType,
      );

      // Extract EOSDA field ID (can be number or string)
      eosdaFieldId = eosdaField.id.toString();
      eosdaArea = String(eosdaField.area); // AGROmonitoring returns area directly in hectares

      this.logger.log(
        `✅ EOSDA field created successfully - Field ID: ${eosdaFieldId}, Area: ${eosdaArea} hectares`,
      );
      this.logger.log(
        `   This EOSDA field ID will be stored in farm record for subsequent API calls (analytics, monitoring, imagery)`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to create EOSDA field: ${error.message}. Farm registration aborted.`,
      );
      throw new BadRequestException(
        `Failed to register farm with EOSDA: ${error.message}. Please ensure EOSDA API is configured correctly.`,
      );
    }

    // Create farm in MongoDB only after EOSDA field is created
    const farmData = {
      farmerId: new Types.ObjectId(farmerId),
      name: createFarmDto.name,
      area,
      cropType: createFarmDto.cropType,
      location,
      boundary: createFarmDto.boundary,
      status: FarmStatus.REGISTERED,
      eosdaFieldId, // Store EOSDA field ID for subsequent API calls
    };

    const farm = await this.farmsRepository.create(farmData);

    this.logger.log(
      `✅ Farm created successfully - Farm ID: ${farm._id}, EOSDA Field ID: ${eosdaFieldId}`,
    );
    this.logger.log(
      `   EOSDA field ID ${eosdaFieldId} is now stored in farm record and will be used for:`,
    );
    this.logger.log(`   - Field Analytics (NDVI, statistics)`);
    this.logger.log(`   - Field Imagery (satellite imagery)`);
    this.logger.log(`   - Weather Data (forecasts, historical)`);
    this.logger.log(`   - Ongoing Monitoring (alerts, thresholds)`);

    return this.mapToFarmResponse(farm);
  }

  async createFromShapefile(
    farmerId: string,
    name: string,
    shapefileBuffer: Buffer,
    cropType?: string,
  ): Promise<FarmResponseDto> {
    // Parse shapefile
    const boundary = await this.shapefileParser.parseShapefile(shapefileBuffer);

    // Calculate area and centroid
    const area = this.shapefileParser.calculateArea(boundary);
    const centroid = this.shapefileParser.calculateCentroid(boundary);

    // Create EOSDA field FIRST - if this fails, don't create the farm
    let eosdaFieldId: string | undefined;
    let eosdaArea: string | undefined;
    try {
      const eosdaField = await this.createEosdaField(name, boundary, cropType);

      // Extract EOSDA field ID (can be number or string)
      eosdaFieldId = eosdaField.id.toString();
      eosdaArea = String(eosdaField.area); // AGROmonitoring returns area directly in hectares

      this.logger.log(
        `✅ EOSDA field created successfully - Field ID: ${eosdaFieldId}, Area: ${eosdaArea} hectares`,
      );
      this.logger.log(
        `   This EOSDA field ID will be stored in farm record for subsequent API calls`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to create EOSDA field: ${error.message}. Farm registration aborted.`,
      );
      throw new BadRequestException(
        `Failed to register farm with EOSDA: ${error.message}. Please ensure EOSDA API is configured correctly.`,
      );
    }

    // Create farm in MongoDB only after EOSDA field is created
    const farmData = {
      farmerId: new Types.ObjectId(farmerId),
      name,
      area,
      cropType: cropType as any,
      location: {
        type: 'Point' as const,
        coordinates: centroid,
      },
      boundary,
      status: FarmStatus.REGISTERED,
      eosdaFieldId, // Store EOSDA field ID for subsequent API calls
    };

    const farm = await this.farmsRepository.create(farmData);

    this.logger.log(
      `✅ Farm created successfully - Farm ID: ${farm._id}, EOSDA Field ID: ${eosdaFieldId}`,
    );

    return this.mapToFarmResponse(farm);
  }

  async createFromKML(
    farmerId: string,
    name: string,
    kmlBuffer: Buffer,
    cropType?: string,
  ): Promise<FarmResponseDto> {
    // Parse KML
    const boundary = await this.shapefileParser.parseKML(kmlBuffer);

    // Calculate area and centroid
    const area = this.shapefileParser.calculateArea(boundary);
    const centroid = this.shapefileParser.calculateCentroid(boundary);

    // Create EOSDA field FIRST - if this fails, don't create the farm
    let eosdaFieldId: string | undefined;
    let eosdaArea: string | undefined;
    try {
      const eosdaField = await this.createEosdaField(name, boundary, cropType);

      // Extract EOSDA field ID (can be number or string)
      eosdaFieldId = eosdaField.id.toString();
      eosdaArea = String(eosdaField.area); // AGROmonitoring returns area directly in hectares

      this.logger.log(
        `✅ EOSDA field created successfully - Field ID: ${eosdaFieldId}, Area: ${eosdaArea} hectares`,
      );
      this.logger.log(
        `   This EOSDA field ID will be stored in farm record for subsequent API calls`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to create EOSDA field: ${error.message}. Farm registration aborted.`,
      );
      throw new BadRequestException(
        `Failed to register farm with EOSDA: ${error.message}. Please ensure EOSDA API is configured correctly.`,
      );
    }

    // Create farm in MongoDB only after EOSDA field is created
    const farmData = {
      farmerId: new Types.ObjectId(farmerId),
      name,
      area,
      cropType: cropType as any,
      location: {
        type: 'Point' as const,
        coordinates: centroid,
      },
      boundary,
      status: FarmStatus.REGISTERED,
      eosdaFieldId, // Store EOSDA field ID for subsequent API calls
    };

    const farm = await this.farmsRepository.create(farmData);

    this.logger.log(
      `✅ Farm created successfully - Farm ID: ${farm._id}, EOSDA Field ID: ${eosdaFieldId}`,
    );

    return this.mapToFarmResponse(farm);
  }

  /**
   * Create EOSDA field and return the response
   * This is called BEFORE creating the farm in MongoDB
   * If this fails, farm creation is aborted
   *
   * Returns the EOSDA field response containing:
   * - id: Field ID (number or string) - MUST be stored for subsequent API calls
   * - area: Calculated area in hectares (string format)
   */
  private async createEosdaField(
    farmName: string,
    boundary: any,
    cropType?: string,
    sowingDate?: Date,
  ) {
    this.logger.log(`Creating EOSDA field for: ${farmName}`);
    this.logger.debug(`Boundary type: ${boundary.type}`);
    this.logger.debug(
      `Boundary coordinates preview: ${JSON.stringify(boundary.coordinates).substring(0, 200)}...`,
    );

    // Format sowing date for EOSDA API (YYYY-MM-DD)
    let sowingDateStr: string;
    if (sowingDate) {
      const year = sowingDate.getFullYear();
      const month = String(sowingDate.getMonth() + 1).padStart(2, '0');
      const day = String(sowingDate.getDate()).padStart(2, '0');
      sowingDateStr = `${year}-${month}-${day}`;
    } else {
      // Default to April 1st of current year
      sowingDateStr = `${new Date().getFullYear()}-04-01`;
    }

    // Create field in EOSDA with proper format
    const eosdaField = await this.agromonitoringService.fieldManagement.createField({
      name: farmName,
      geo_json: { type: 'Feature', properties: { name: '' }, geometry: boundary },
      cropType,
      year: new Date().getFullYear(),
      sowingDate: sowingDateStr,
    });

    this.logger.debug(
      `EOSDA API Response received: id=${eosdaField.id}, area=${String(eosdaField.area)}`,
    );

    return eosdaField;
  }

  async findAll(farmerId?: string, page: number = 0, limit: number = 10): Promise<any> {
    // Convert farmerId string to ObjectId for MongoDB query
    const filters: any = {};
    if (farmerId) {
      filters.farmerId = new Types.ObjectId(farmerId);
    }
    const farms = await this.farmsRepository.findAll(page, limit, filters);

    // Map each farm to include locationName
    return {
      ...farms,
      items: farms.items.map(farm => this.mapToFarmResponse(farm)),
    };
  }

  async findById(id: string): Promise<FarmResponseDto> {
    const farm = await this.farmsRepository.findById(id);
    if (!farm) {
      throw new NotFoundException('Farm', id);
    }

    // Log EOSDA field ID if available
    if (farm.eosdaFieldId) {
      this.logger.debug(`Retrieved farm ${id} with EOSDA field ID: ${farm.eosdaFieldId}`);
    }

    // Get location name from coordinates
    let locationName: string | undefined;
    if (farm.location && farm.location.coordinates && farm.location.coordinates.length >= 2) {
      const longitude = farm.location.coordinates[0];
      const latitude = farm.location.coordinates[1];
      try {
        locationName = await this.locationService.getLocationString(latitude, longitude);
      } catch (err: any) {
        this.logger.warn(`Failed to get location name: ${err.message}`);
      }
    }

    // Build response with location name
    const response = this.mapToFarmResponse(farm);
    response.locationName = locationName;

    return response;
  }

  async findByFarmerId(farmerId: string): Promise<FarmResponseDto[]> {
    const farms = await this.farmsRepository.findByFarmerId(farmerId);
    return farms.map(farm => this.mapToFarmResponse(farm));
  }

  async update(id: string, updateData: Partial<CreateFarmDto>) {
    const farm = await this.farmsRepository.findById(id);
    if (!farm) {
      throw new NotFoundException('Farm', id);
    }

    if (updateData.boundary) {
      this.validateGeometry(updateData.boundary);
      const area = this.shapefileParser.calculateArea(updateData.boundary);
      const centroid = this.shapefileParser.calculateCentroid(updateData.boundary);
      updateData.location = {
        type: 'Point',
        coordinates: centroid,
      };
      (updateData as any).area = area;
    }

    const updatedFarm = await this.farmsRepository.update(id, updateData);

    // If boundary was updated and EOSDA field exists, update it in EOSDA
    if (updateData.boundary && updatedFarm?.eosdaFieldId) {
      try {
        this.logger.log(`Updating EOSDA field ${updatedFarm.eosdaFieldId} for farm ${id}`);
        await this.agromonitoringService.fieldManagement.updateField(updatedFarm.eosdaFieldId, {
          geo_json: { type: 'Feature', properties: { name: '' }, geometry: updateData.boundary },
          ...(updateData.name && { name: updateData.name }),
          ...(updateData.cropType && { cropType: updateData.cropType }),
        });
        this.logger.log(
          `Successfully updated EOSDA field ${updatedFarm.eosdaFieldId} for farm ${id}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to update EOSDA field ${updatedFarm.eosdaFieldId} for farm ${id}: ${error.message}`,
        );
        // Don't throw - farm update still succeeds even if EOSDA update fails
      }
    }

    return this.mapToFarmResponse(updatedFarm!);
  }

  async createInsuranceRequest(farmerId: string, farmId: string, notes?: string) {
    // Validate farmId is provided
    if (!farmId || farmId.trim() === '') {
      throw new BadRequestException('Farm ID is required');
    }

    const farm = await this.farmsRepository.findById(farmId);
    if (!farm) {
      throw new NotFoundException('Farm', farmId);
    }

    // Normalize both IDs to strings for comparison
    // Note: farmsRepository.findById() populates farmerId, so we get a User object
    // We need to extract the _id from the populated object, or use the ObjectId if not populated
    let farmFarmerId: string;

    if (farm.farmerId instanceof Types.ObjectId) {
      // Not populated - direct ObjectId
      farmFarmerId = farm.farmerId.toString();
    } else if (farm.farmerId && typeof farm.farmerId === 'object') {
      // Populated User object - extract _id
      const farmerDoc = farm.farmerId as any;
      // In Mongoose, populated documents have _id or id property
      farmFarmerId = (farmerDoc._id || farmerDoc.id || farmerDoc).toString();
    } else {
      // Fallback: convert to string
      farmFarmerId = String(farm.farmerId).trim();
    }

    const normalizedFarmerId = String(farmerId).trim();

    this.logger.debug(
      `Comparing farmer IDs - Farm farmerId: "${farmFarmerId}" (type: ${typeof farmFarmerId}), Request farmerId: "${normalizedFarmerId}" (type: ${typeof normalizedFarmerId})`,
    );

    if (farmFarmerId !== normalizedFarmerId) {
      this.logger.error(
        `Farm ownership mismatch - Farm ID: ${farmId}, Farm farmerId: "${farmFarmerId}", Request farmerId: "${normalizedFarmerId}"`,
      );
      throw new BadRequestException('Farm does not belong to this farmer');
    }

    // Check if there's already a pending insurance request for this farm
    const existingRequests = await this.insuranceRequestsRepository.findByStatus(
      InsuranceRequestStatus.PENDING,
    );
    const hasExistingRequest = existingRequests.some(req => req.farmId.toString() === farmId);

    if (hasExistingRequest) {
      throw new BadRequestException('An insurance request already exists for this farm');
    }

    const request = await this.insuranceRequestsRepository.create({
      farmerId: new Types.ObjectId(farmerId),
      farmId: new Types.ObjectId(farmId),
      status: InsuranceRequestStatus.PENDING,
      notes,
    });

    return request;
  }

  async getInsuranceRequests(farmerId?: string, insurerId?: string) {
    this.logger.debug(
      `Getting insurance requests - farmerId: ${farmerId}, insurerId: ${insurerId}`,
    );

    if (farmerId) {
      // Farmer sees only their own requests
      const requests = await this.insuranceRequestsRepository.findByFarmerId(farmerId);
      this.logger.debug(`Found ${requests.length} insurance requests for farmer ${farmerId}`);
      return requests;
    }

    if (insurerId) {
      // Insurer sees requests assigned to them OR all pending requests (unassigned)
      // First, get requests assigned to this insurer
      const assignedRequests = await this.insuranceRequestsRepository.findByInsurerId(insurerId);

      // Also get all pending requests (for assigning to insurers)
      const pendingRequests = await this.insuranceRequestsRepository.findByStatus(
        InsuranceRequestStatus.PENDING,
      );

      // Combine and deduplicate (in case a request is both assigned and pending - shouldn't happen but be safe)
      const allRequests = [...assignedRequests, ...pendingRequests];
      const uniqueRequests = Array.from(
        new Map(
          allRequests.map(req => [(req as any)._id?.toString() || req.id || String(req), req]),
        ).values(),
      );

      this.logger.debug(
        `Found ${assignedRequests.length} assigned and ${pendingRequests.length} pending requests for insurer ${insurerId}`,
      );
      return uniqueRequests;
    }

    // No specific user - return all pending requests (admin or public access)
    const requests = await this.insuranceRequestsRepository.findByStatus(
      InsuranceRequestStatus.PENDING,
    );
    this.logger.debug(`Found ${requests.length} pending insurance requests`);
    return requests;
  }

  private validateGeometry(boundary: any): void {
    if (!boundary || !boundary.type || !boundary.coordinates) {
      throw new BadRequestException('Invalid boundary geometry');
    }

    if (boundary.type !== 'Polygon' && boundary.type !== 'MultiPolygon') {
      throw new BadRequestException('Boundary must be a Polygon or MultiPolygon');
    }

    // Basic validation: check if coordinates are valid
    if (!Array.isArray(boundary.coordinates)) {
      throw new BadRequestException('Invalid boundary coordinates');
    }
  }

  private mapToFarmResponse(farm: any): FarmResponseDto {
    // Handle farmerId - could be an ObjectId or a populated User object
    let farmerIdValue: string;
    let farmerName: string | undefined;

    if (farm.farmerId && typeof farm.farmerId === 'object') {
      // It's a populated User object, extract the _id and name
      farmerIdValue = farm.farmerId._id?.toString() || farm.farmerId.toString();
      // Build farmer name from firstName and lastName
      const firstName = farm.farmerId.firstName || '';
      const lastName = farm.farmerId.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      farmerName = fullName || undefined;
    } else {
      // It's an ObjectId
      farmerIdValue = farm.farmerId?.toString() || '';
    }

    // Get location name from coordinates if available
    let locationName: string | undefined;
    if (farm.location && farm.location.coordinates && farm.location.coordinates.length >= 2) {
      // Coordinates are [longitude, latitude]
      const longitude = farm.location.coordinates[0];
      const latitude = farm.location.coordinates[1];
      // Get location name synchronously (will be cached internally)
      // Note: This is a simplified approach - in production you might want to cache this
      this.locationService
        .getLocationString(latitude, longitude)
        .then(name => {
          if (name) {
            locationName = name;
          }
        })
        .catch(err => {
          this.logger.warn(`Failed to get location name: ${err.message}`);
        });
    }

    const response = {
      id: farm._id.toString(),
      farmerId: farmerIdValue,
      farmerName: farmerName,
      name: farm.name,
      area: farm.area,
      cropType: farm.cropType,
      sowingDate: farm.sowingDate,
      location: farm.location,
      locationName: locationName,
      boundary: farm.boundary,
      status: farm.status,
      shapefilePath: farm.shapefilePath,
      eosdaFieldId: farm.eosdaFieldId, // EOSDA field ID for subsequent API calls
      createdAt: farm.createdAt,
      updatedAt: farm.updatedAt,
    };

    // Log if EOSDA field ID is present
    if (response.eosdaFieldId) {
      this.logger.debug(`Farm response includes EOSDA field ID: ${response.eosdaFieldId}`);
    }

    return response;
  }

  /**
   * Get farm for analytics - ensures farm exists and has required data
   */
  private async getFarmForAnalytics(farmId: string) {
    const farm = await this.farmsRepository.findById(farmId);
    if (!farm) {
      throw new NotFoundException('Farm', farmId);
    }

    // Farm must have either eosdaFieldId or boundary for EOSDA API calls
    if (!farm.eosdaFieldId && !farm.boundary) {
      throw new BadRequestException(
        'Farm must have either EOSDA field ID or boundary geometry for analytics',
      );
    }

    return farm;
  }

  /**
   * Get weather forecast for a farm
   * Uses farm's coordinates to call AGROmonitoring weather API
   */
  async getWeatherForecast(farmId: string, dateStart: string, dateEnd: string) {
    const farm = await this.getFarmForAnalytics(farmId);

    if (!farm.location || !farm.location.coordinates) {
      throw new BadRequestException(
        'Farm must have location coordinates for weather forecast. Please ensure farm has location data.',
      );
    }

    const [lon, lat] = farm.location.coordinates;
    return this.agromonitoringService.weather.getWeatherForecast(lat, lon);
  }

  /**
   * Get historical weather data for a farm
   * Uses farm's coordinates to call AGROmonitoring weather API
   */
  async getHistoricalWeather(farmId: string, dateStart: string, dateEnd: string) {
    const farm = await this.getFarmForAnalytics(farmId);

    if (!farm.location || !farm.location.coordinates) {
      throw new BadRequestException(
        'Farm must have location coordinates for historical weather. Please ensure farm has location data.',
      );
    }

    const [lon, lat] = farm.location.coordinates;
    return this.agromonitoringService.weather.getWeatherHistory({
      lat,
      lon,
      dateStart,
      dateEnd,
    });
  }

  /**
   * Get accumulated weather data for a farm
   * Uses farm's coordinates to call AGROmonitoring weather API
   */
  async getAccumulatedWeather(
    farmId: string,
    dateStart: string,
    dateEnd: string,
    sumOfActiveTemperatures?: number,
    provider?: string,
  ) {
    const farm = await this.getFarmForAnalytics(farmId);

    if (!farm.location || !farm.location.coordinates) {
      throw new BadRequestException(
        'Farm must have location coordinates for accumulated weather. Please ensure farm has location data.',
      );
    }

    const [lon, lat] = farm.location.coordinates;
    return this.agromonitoringService.weather.getAccumulatedWeather(lat, lon, dateStart, dateEnd);
  }

  /**
   * Get vegetation indices statistics (NDVI, MSAVI, NDMI, EVI) for a farm
   * Can use either eosdaFieldId (faster) or geometry (boundary)
   */
  async getIndicesStatistics(
    farmId: string,
    dateStart: string,
    dateEnd: string,
    indices?: string[],
    sensors?: ('sentinel2' | 'sentinel1')[],
    limit?: number,
    excludeCoverPixels?: boolean,
    cloudMaskingLevel?: 'best' | 'normal' | 'basic',
  ) {
    const farm = await this.getFarmForAnalytics(farmId);

    const request: any = {
      startDate: dateStart,
      endDate: dateEnd,
      indices: indices || ['NDVI', 'MSAVI', 'NDMI', 'EVI'],
      sensors: sensors || ['sentinel2'],
      limit: limit || 100,
      excludeCoverPixels: excludeCoverPixels !== undefined ? excludeCoverPixels : true,
      cloudMaskingLevel: cloudMaskingLevel || 'best',
    };

    // Prefer fieldId (faster), fallback to geometry
    if (farm.eosdaFieldId) {
      request.fieldId = farm.eosdaFieldId;
    } else if (farm.boundary) {
      request.geometry = farm.boundary;
    }

    return this.agromonitoringService.fieldAnalytics.getStatistics({
      fieldId: farm.eosdaFieldId,
      startDate: dateStart,
      endDate: dateEnd,
    });
  }

  /**
   * Get NDVI time series for a farm
   * Convenience method that uses getIndicesStatistics with NDVI only
   */
  async getNDVITimeSeries(farmId: string, dateStart: string, dateEnd: string) {
    const farm = await this.getFarmForAnalytics(farmId);

    const request: any = {
      startDate: dateStart,
      endDate: dateEnd,
      indices: ['NDVI'],
    };

    // Prefer fieldId (faster), fallback to geometry
    if (farm.eosdaFieldId) {
      request.fieldId = farm.eosdaFieldId;
    } else if (farm.boundary) {
      request.geometry = farm.boundary;
    }

    return this.agromonitoringService.fieldAnalytics.getNDVITimeSeries(request);
  }

  /**
   * Get field trend (NDVI or other index over time) for a farm
   * Uses eosdaFieldId (required for this API)
   */
  async getFieldTrend(
    farmId: string,
    dateStart: string,
    dateEnd: string,
    index?: 'NDVI' | 'MSAVI' | 'NDMI' | 'EVI',
    dataSource?: 'S2' | 'S1',
  ): Promise<any> {
    const farm = await this.getFarmForAnalytics(farmId);

    if (!farm.eosdaFieldId) {
      throw new BadRequestException(
        'Farm must have EOSDA field ID for field trend. Please register farm with EOSDA first.',
      );
    }

    return this.agromonitoringService.fieldAnalytics.getNDVIData({
      fieldId: farm.eosdaFieldId,
      start: dateStart,
      end: dateEnd,
    });
  }

  /**
   * Get NDVI data for a farm
   */
  async getNDVIData(
    farmId: string,
    dateStart: string,
    dateEnd: string,
    index?: 'NDVI' | 'MSAVI' | 'NDMI' | 'EVI',
    dataSource?: 'S2' | 'S1',
  ): Promise<any> {
    const farm = await this.getFarmForAnalytics(farmId);

    if (!farm.eosdaFieldId) {
      throw new BadRequestException(
        'Farm must have EOSDA field ID for field trend. Please register farm with EOSDA first.',
      );
    }

    return this.agromonitoringService.fieldAnalytics.getNDVIData({
      fieldId: farm.eosdaFieldId,
      start: dateStart,
      end: dateEnd,
    });
  }

  /**
   * Register existing farm with AGROmonitoring
   * This method creates AGROmonitoring field for farms that already have geometry
   */
  async registerWithAgromonitoring(farmId: string): Promise<FarmResponseDto> {
    this.logger.log(`Registering farm ${farmId} with AGROmonitoring`);

    // Get farm with geometry
    const farm = await this.farmsRepository.findById(farmId);
    if (!farm) {
      throw new NotFoundException('Farm', farmId);
    }

    if (!farm.boundary) {
      throw new BadRequestException(
        'Farm must have boundary geometry to register with AGROmonitoring',
      );
    }

    if (farm.eosdaFieldId) {
      this.logger.log(
        `Farm ${farmId} already registered with AGROmonitoring (Field ID: ${farm.eosdaFieldId})`,
      );
      return this.mapToFarmResponse(farm);
    }

    // Create AGROmonitoring field using existing geometry
    let eosdaFieldId: string | undefined;
    let eosdaArea: string | undefined;
    try {
      const eosdaField = await this.createEosdaField(
        farm.name || 'Unknown Farm',
        farm.boundary,
        farm.cropType,
        farm.sowingDate ? new Date(farm.sowingDate) : undefined,
      );

      eosdaFieldId = eosdaField.id.toString();
      eosdaArea = String(eosdaField.area); // AGROmonitoring returns area directly in hectares

      this.logger.log(
        ` AGROmonitoring field created successfully - Field ID: ${eosdaFieldId}, Area: ${eosdaArea} hectares`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to create AGROmonitoring field: ${error.message}. Farm registration aborted.`,
      );

      // Provide more user-friendly error messages for common AGROmonitoring validation errors
      if (error.message.includes('must be from 1 to 3000 ha')) {
        throw new BadRequestException(
          `Farm area is too small for AGROmonitoring registration. Farm must be between 1-3000 hectares, but current farm is ${farm.area ? (farm.area / 10000).toFixed(2) : 'unknown'} hectares. Please ensure farm boundary covers at least 1 hectare.`,
        );
      }

      throw new BadRequestException(
        `Failed to register farm with AGROmonitoring: ${error.message}. Please ensure AGROmonitoring API is configured correctly.`,
      );
    }

    // Update farm with AGROmonitoring field ID
    const updatedFarm = await this.farmsRepository.update(farmId, {
      eosdaFieldId,
      status: FarmStatus.REGISTERED,
    });

    this.logger.log(` Farm ${farmId} registered with AGROmonitoring - Field ID: ${eosdaFieldId}`);

    return this.mapToFarmResponse(updatedFarm);
  }
}
