import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { BookSlotDto, CreateSlotDto, UpdateSlotStatusDto } from './dto';

@Controller('v1/appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.service.list(from, to, professionalId, status, facilityId);
  }

  @Post()
  create(@Body() dto: CreateSlotDto) {
    return this.service.create(dto);
  }

  @Post(':id/book')
  book(@Param('id') id: string, @Body() dto: BookSlotDto) {
    return this.service.book(id, dto);
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
