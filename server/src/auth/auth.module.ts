import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupabaseModule } from '../common/supabase/supabase.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { KakaoOAuthService } from './kakao-oauth.service';
import { NaverOAuthService } from './naver-oauth.service';
import { TokenCipherService } from './token-cipher.service';

// JwtModule 은 AdminAuthModule 에서 global 로 등록되어 있어 여기서는 다시 import 하지 않는다.
@Module({
  // 탈퇴 시 인증 사진을 지운다
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [AuthService, KakaoOAuthService, NaverOAuthService, TokenCipherService, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
