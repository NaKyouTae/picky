import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminAuthModule } from './admin/auth/admin-auth.module';
import { AdminChallengeCategoriesModule } from './admin/challenge-categories/admin-challenge-categories.module';
import { AdminChallengesModule } from './admin/challenges/admin-challenges.module';
import { AdminStickerTemplatesModule } from './admin/sticker-templates/admin-sticker-templates.module';
import { AdminUsersModule } from './admin/users/admin-users.module';
import { AuthModule } from './auth/auth.module';
import { ChallengeGroupsModule } from './challenge-groups/challenge-groups.module';
import { ChallengesModule } from './challenges/challenges.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { SupabaseModule } from './common/supabase/supabase.module';
import { HealthController } from './health/health.controller';
import { StickerTemplatesModule } from './sticker-templates/sticker-templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    SupabaseModule,
    AdminAuthModule,
    AdminUsersModule,
    AdminChallengeCategoriesModule,
    AdminChallengesModule,
    AdminStickerTemplatesModule,
    AuthModule,
    ChallengeGroupsModule,
    ChallengesModule,
    StickerTemplatesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
