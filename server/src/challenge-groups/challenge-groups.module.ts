import { Module } from '@nestjs/common';
import { ChallengesModule } from '../challenges/challenges.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChallengeGroupsController } from './challenge-groups.controller';
import { ChallengeGroupsService } from './challenge-groups.service';

// JwtModule 은 AdminAuthModule 에서 global 로 등록되어 있어 여기서는 다시 import 하지 않는다.
@Module({
  // 그룹 시작·다음 뽑기에서 랜덤 뽑기 로직을 재사용한다
  imports: [ChallengesModule],
  controllers: [ChallengeGroupsController],
  providers: [ChallengeGroupsService, JwtAuthGuard],
})
export class ChallengeGroupsModule {}
