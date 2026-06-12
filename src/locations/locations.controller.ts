import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { 
  RwandaLocationQueryDto, 
  ProvinceQueryDto, 
  DistrictQueryDto, 
  SectorQueryDto, 
  CellQueryDto, 
  VillageQueryDto 
} from './dto/rwanda-location-query.dto';

@ApiTags('Rwanda Locations')
@Controller()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'Get all Rwanda provinces (Public)' })
  @ApiOkResponse({ description: 'List of provinces' })
  getProvinces(@Query() query: ProvinceQueryDto) {
    return this.locationsService.getProvinces(query);
  }

  @Get('districts')
  @ApiOperation({ summary: 'Get districts filtered by province (Public)' })
  @ApiOkResponse({ description: 'List of districts filtered by province' })
  getDistricts(@Query() query: DistrictQueryDto) {
    return this.locationsService.getDistricts(query);
  }

  @Get('sectors')
  @ApiOperation({ summary: 'Get sectors filtered by district (Public)' })
  @ApiOkResponse({ description: 'List of sectors filtered by province and district' })
  getSectors(@Query() query: SectorQueryDto) {
    return this.locationsService.getSectors(query);
  }

  @Get('villages')
  @ApiOperation({ summary: 'Get villages filtered by cell (Public)' })
  @ApiOkResponse({ description: 'List of villages filtered by province, district, and sector' })
  getVillages(@Query() query: VillageQueryDto) {
    return this.locationsService.getVillages(query);
  }

  @Get('cells')
  @ApiOperation({ summary: 'Get cells filtered by sector (Public)' })
  @ApiOkResponse({ description: 'List of cells filtered by province, district, sector, and village' })
  getCells(@Query() query: CellQueryDto) {
    return this.locationsService.getCells(query);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get complete Rwanda location tree (Public)' })
  @ApiOkResponse({ description: 'Complete location tree as JSON' })
  getTree() {
    return this.locationsService.getTree();
  }
}
