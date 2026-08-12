import { Controller, Get, Module } from '@nestjs/common';
import { lediEnumCatalog } from './db-enums';

@Controller('v1/ledi')
class LediController {
  @Get('enums')
  enums() {
    return lediEnumCatalog();
  }
}

@Module({
  controllers: [LediController],
})
export class LediModule {}
