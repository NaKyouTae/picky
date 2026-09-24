import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';

// JwtModule 은 AdminAuthModule 에서 global 로 등록되어 있어 여기서는 다시 import 하지 않는다.
@Module({
  controllers: [InquiriesController],
  providers: [InquiriesService, JwtAuthGuard],
})
export class InquiriesModule {}
