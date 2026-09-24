import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type AuthedRequest } from '../common/guards/jwt-auth.guard';
import { ListNoticesDto } from './dto/list-notices.dto';
import { NoticesService } from './notices.service';

/**
 * 공지사항 (앱 마이페이지).
 *
 * 공지 내용 자체는 누구에게나 같지만 (New)·점이 사람마다 달라 전부 로그인을 요구한다 —
 * 들어오는 입구도 마이페이지뿐이다.
 */
@ApiTags('notices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  @ApiOperation({ summary: '공지사항 목록 (본문·읽음 여부 포함, 커서 페이지네이션)' })
  list(@Req() req: AuthedRequest, @Query() query: ListNoticesDto) {
    return this.notices.listPublished(req.user!.sub, query);
  }

  // ':id' 로 시작하는 경로보다 먼저 선언해야 'unread' 가 uuid 로 해석되지 않는다.
  @Get('unread')
  @ApiOperation({ summary: '아직 확인하지 않은 공지가 있는지 (마이페이지 점)' })
  getUnreadStatus(@Req() req: AuthedRequest) {
    return this.notices.getUnreadStatus(req.user!.sub);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '공지 한 건을 읽은 것으로 기록 ((New) 를 뗀다)' })
  markRead(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.notices.markRead(req.user!.sub, id);
  }
}
