import { Controller, Get, Param } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('states')
  async listStates() {
    return this.locationsService.listStates();
  }

  @Get('states/:stateSigla/cities')
  async listCities(@Param('stateSigla') stateSigla: string) {
    return this.locationsService.listCities(stateSigla);
  }

  @Get('cep/:cep')
  async lookupCep(@Param('cep') cep: string) {
    return this.locationsService.lookupCep(cep);
  }
}
