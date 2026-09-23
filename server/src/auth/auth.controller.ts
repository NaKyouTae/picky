import {
  Body,
  Controller,
  Delete,
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
import { AppleCallbackDto } from './dto/apple-callback.dto';
import { AuthService } from './auth.service';
import { KakaoCallbackDto } from './dto/kakao-callback.dto';
import { NaverCallbackDto } from './dto/naver-callback.dto';
import { UpdateConsentsDto } from './dto/update-consents.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('kakao/authorize')
  @ApiOperation({ summary: '카카오 로그인 시작 — 인가 URL 과 일회용 값 발급' })
  kakaoAuthorize() {
    return this.auth.createKakaoAuthorizeRequest();
  }

  @Post('kakao/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '카카오 콜백 — 인가 코드를 세션(JWT)으로 교환' })
  kakaoCallback(@Body() dto: KakaoCallbackDto) {
    return this.auth.loginWithKakao(dto.code, dto.codeVerifier);
  }

  @Get('naver/authorize')
  @ApiOperation({ summary: '네이버 로그인 시작 — 인가 URL 과 일회용 state 발급' })
  naverAuthorize() {
    return this.auth.createNaverAuthorizeRequest();
  }

  @Post('naver/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '네이버 콜백 — 인가 코드를 세션(JWT)으로 교환' })
  naverCallback(@Body() dto: NaverCallbackDto) {
    return this.auth.loginWithNaver(dto.code, dto.state);
  }

  @Get('apple/authorize')
  @ApiOperation({ summary: '애플 로그인 시작 — 인가 URL 과 일회용 state 발급' })
  appleAuthorize() {
    return this.auth.createAppleAuthorizeRequest();
  }

  @Post('apple/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '애플 콜백 — 인가 코드를 세션(JWT)으로 교환' })
  appleCallback(@Body() dto: AppleCallbackDto) {
    return this.auth.loginWithApple(dto.code, dto.name ?? null);
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

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '회원 탈퇴 — 개인정보를 파기하고 계정을 비활성화한다' })
  withdraw(@Req() req: AuthedRequest) {
    return this.auth.withdraw(req.user!.sub);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보 — 제공자에게 받아 보관 중인 수집 항목' })
  async profile(@Req() req: AuthedRequest) {
    const profile = await this.auth.getProfile(req.user!.sub);
    if (!profile) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return profile;
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
