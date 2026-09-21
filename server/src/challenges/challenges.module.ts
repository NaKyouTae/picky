import { Module } from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  controllers: [ChallengesController],
  providers: [ChallengesService],
  // 챌린지 시작 시 랜덤 뽑기를 재사용하기 위해 내보낸다
  exports: [ChallengesService],
})
export class ChallengesModule {}
