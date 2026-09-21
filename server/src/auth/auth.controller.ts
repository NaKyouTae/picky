import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type AuthedRequest } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { GoogleCallbackDto } from './dto/google-callback.dto';
import { KakaoCallbackDto } from './dto/kakao-callback.dto';
import { UpdateConsentsDto } from './dto/update-consents.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google/authorize')
  @ApiOperation({ summary: '구글 로그인 시작 — 인가 URL 과 일회용 값 발급' })
  googleAuthorize() {
    return this.auth.createGoogleAuthorizeRequest();
  }

  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '구글 콜백 — 인가 코드를 세션(JWT)으로 교환' })
  googleCallback(@Body() dto: GoogleCallbackDto) {
    return this.auth.loginWithGoogle(dto.code, dto.nonce, dto.codeVerifier);
  }

  @Get('kakao/authorize')
  @ApiOperation({ summary: '카카오 로그인 시작 — 인가 URL 과 일회용 값 발급' })
  kakaoAuthorize() {
    return this.auth.createKakaoAuthorizeRequest();
  }

  @Post('kakao/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '카카오 콜백 — 인가 코드를 세션(JWT)으로 교환' })
  kakaoCallback(@Body() dto: KakaoCallbackDto) {
    return this.auth.loginWithKakao(dto.code, dto.nonce, dto.codeVerifier);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '현재 로그인한 사용자' })
  async me(@Req() req: AuthedRequest) {
    const user = await this.auth.getMe(req.user!.sub);
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  @Get('consents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '약관·개인정보 동의 상태' })
  getConsents(@Req() req: AuthedRequest) {
    return this.auth.getConsents(req.user!.sub);
  }

  @Patch('consents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '동의 변경 — 보낸 항목만 바뀐다' })
  updateConsents(@Req() req: AuthedRequest, @Body() dto: UpdateConsentsDto) {
    return this.auth.updateConsents(req.user!.sub, dto);
  }
}
