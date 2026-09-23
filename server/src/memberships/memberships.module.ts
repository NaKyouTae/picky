import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AppleIapService } from './apple-iap.service';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { TossPaymentsService } from './toss-payments.service';

// JwtModule 은 AuthModule 에서 global 로 등록되어 있어 여기서는 다시 import 하지 않는다.
@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService, TossPaymentsService, AppleIapService, JwtAuthGuard],
  // 콜라주 보관·내려받기가 회원권 유효 여부를 물어본다 (CollagesModule).
  exports: [MembershipsService],
})
export class MembershipsModule {}
