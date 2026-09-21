import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminChallengeCategoriesController } from './admin-challenge-categories.controller';
import { AdminChallengeCategoriesService } from './admin-challenge-categories.service';

// JwtModule 은 AdminAuthModule 에서 global 로 등록되어 있어 여기서는 다시 import 하지 않는다.
@Module({
  controllers: [AdminChallengeCategoriesController],
  providers: [AdminChallengeCategoriesService, AdminGuard],
})
export class AdminChallengeCategoriesModule {}
