import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import {
  BookSlotDto,
  CreateSlotDto,
  OpenApsFromSlotDto,
  OpenDentalFromSlotDto,
  UpdateSlotStatusDto,
} from './dto';

@Controller('v1/appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get('catalog')
  catalog() {
    return this.service.catalog();
  }

  @Get('day-grid')
  dayGrid(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('careLine') careLine?: string,
    @Query('itemType') itemType?: string,
    @Query('slotMinutes') slotMinutes?: string,
  ) {
    const minutes = slotMinutes ? Number(slotMinutes) : undefined;
    return this.service.dayGrid({
      from,
      to,
      professionalId,
      facilityId,
      careLine,
      itemType,
      slotMinutes: Number.isFinite(minutes) ? minutes : undefined,
    });
  }

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
    @Query('facilityId') facilityId?: string,
    @Query('careLine') careLine?: string,
    @Query('itemType') itemType?: string,
  ) {
    return this.service.list(from, to, professionalId, status, facilityId, careLine, itemType);
  }

  @Post()
  create(@Body() dto: CreateSlotDto) {
    return this.service.create(dto);
  }

  @Post(':id/book')
  book(@Param('id') id: string, @Body() dto: BookSlotDto) {
    return this.service.book(id, dto);
  }

  /** RF-12.1 — abre atendimento odonto a partir do slot */
  @Post(':id/open-dental')
  openDental(@Param('id') id: string, @Body() dto: OpenDentalFromSlotDto) {
    return this.service.openDental(id, dto);
  }

  /** RF-3.5 — abre atendimento APS/FAI a partir do slot */
  @Post(':id/open-aps')
  openAps(@Param('id') id: string, @Body() dto: OpenApsFromSlotDto) {
    return this.service.openAps(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateSlotStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
