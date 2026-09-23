import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupabaseModule } from '../common/supabase/supabase.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { CollagesController } from './collages.controller';
import { CollagesService } from './collages.service';

// JwtModule 은 AdminAuthModule 에서 global 로 등록되어 있어 여기서는 다시 import 하지 않는다.
@Module({
  // 보관·내려받기 모두 회원권이 살아 있는지 확인한다 (MembershipsService.assertActive)
  imports: [SupabaseModule, MembershipsModule],
  controllers: [CollagesController],
  providers: [CollagesService, JwtAuthGuard],
})
export class CollagesModule {}
