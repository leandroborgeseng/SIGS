import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service';
import { CallTicketDto, EmitTicketDto, FinishTicketDto, CallNextDto } from './dto';
import { Public } from '../auth/decorators';

@Controller('v1/queue')
export class QueueController {
  constructor(private readonly service: QueueService) {}

  @Get('catalog')
  catalog() {
    return this.service.catalog();
  }

  /** Painel público (TV) — só leitura da unidade. */
  @Public()
  @Get('panel')
  panel(@Query('facilityId') facilityId: string) {
    return this.service.panel(facilityId);
  }

  @Get('tickets')
  list(@Query('facilityId') facilityId: string, @Query('status') status?: string) {
    return this.service.list(facilityId, status);
  }

  @Post('tickets')
  emit(@Body() dto: EmitTicketDto) {
    return this.service.emit(dto);
  }

  @Post('tickets/:id/call')
  call(@Param('id') id: string, @Body() dto: CallTicketDto) {
    return this.service.call(id, dto);
  }

  @Post('call-next')
  callNext(@Body() dto: CallNextDto) {
    return this.service.callNext(dto.facilityId, dto);
  }

  @Post('tickets/:id/finish')
  finish(@Param('id') id: string, @Body() dto: FinishTicketDto) {
    return this.service.finish(id, dto);
  }
}
