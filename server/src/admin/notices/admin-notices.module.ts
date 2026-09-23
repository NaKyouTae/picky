import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminNoticesController } from './admin-notices.controller';
import { AdminNoticesService } from './admin-notices.service';

// JwtModule 은 AdminAuthModule 에서 global 로 등록되어 있어 여기서는 다시 import 하지 않는다.
@Module({
  controllers: [AdminNoticesController],
  providers: [AdminNoticesService, AdminGuard],
})
export class AdminNoticesModule {}
