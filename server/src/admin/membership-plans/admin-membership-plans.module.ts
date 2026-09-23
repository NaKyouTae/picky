import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminMembershipPlansController } from './admin-membership-plans.controller';
import { AdminMembershipPlansService } from './admin-membership-plans.service';

// JwtModule 은 AdminAuthModule 에서 global 로 등록되어 있어 여기서는 다시 import 하지 않는다.
@Module({
  controllers: [AdminMembershipPlansController],
  providers: [AdminMembershipPlansService, AdminGuard],
})
export class AdminMembershipPlansModule {}
