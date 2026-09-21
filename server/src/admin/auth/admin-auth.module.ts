import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

/** 로그인 세션(JWT) 유효 기간 — 환경변수로 받지 않고 코드에 고정 */
const JWT_EXPIRES_IN: JwtSignOptions['expiresIn'] = '7d';

@Module({
  imports: [
    // global: true — 다른 모듈에서도 AdminGuard 가 JwtService 를 주입받을 수 있도록 한다.
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // 만료 기간은 환경마다 다르지 않아 코드에 고정한다
        signOptions: { expiresIn: JWT_EXPIRES_IN },
      }),
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminGuard],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
