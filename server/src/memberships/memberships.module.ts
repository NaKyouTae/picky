import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { TossPaymentsService } from './toss-payments.service';

// JwtModule 은 AuthModule 에서 global 로 등록되어 있어 여기서는 다시 import 하지 않는다.
@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService, TossPaymentsService, JwtAuthGuard],
})
export class MembershipsModule {}
