import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard, type AdminRequest } from '../../common/guards/admin.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '관리자 로그인 (환경변수 계정 · JWT 발급)' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuth.login(dto);
  }

  @Get('me')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '현재 관리자 세션 확인' })
  me(@Req() req: AdminRequest) {
    return { username: req.admin?.username, role: req.admin?.role };
  }
}
