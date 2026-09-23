import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListNoticesDto } from './dto/list-notices.dto';
import { NoticesService } from './notices.service';

// 공지는 누구에게나 같은 내용이라 가드를 걸지 않는다 (회원권 가격 목록과 같은 성격).
@ApiTags('notices')
@Controller('notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  @ApiOperation({ summary: '공지사항 목록 (커서 페이지네이션)' })
  list(@Query() query: ListNoticesDto) {
    return this.notices.listPublished(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '공지사항 단건 (본문 포함)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.notices.getPublished(id);
  }
}
