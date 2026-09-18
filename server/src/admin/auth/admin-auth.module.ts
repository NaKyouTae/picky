import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

@Module({
  imports: [
    // global: true — 다른 모듈에서도 AdminGuard 가 JwtService 를 주입받을 수 있도록 한다.
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // '7d' 같은 ms 문자열 리터럴 타입을 환경변수(string)로 받기 위한 캐스팅
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '7d') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminGuard],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
