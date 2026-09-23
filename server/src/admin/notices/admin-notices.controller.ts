import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminNoticesService } from './admin-notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { ListAdminNoticesDto } from './dto/list-admin-notices.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';

@ApiTags('admin-notices')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/notices')
export class AdminNoticesController {
  constructor(private readonly notices: AdminNoticesService) {}

  @Get()
  @ApiOperation({ summary: '공지사항 목록 (커서 페이지네이션)' })
  list(@Query() query: ListAdminNoticesDto) {
    return this.notices.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '공지사항 단건' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.notices.get(id);
  }

  @Post()
  @ApiOperation({ summary: '공지사항 등록' })
  create(@Body() dto: CreateNoticeDto) {
    return this.notices.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '공지사항 수정' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoticeDto) {
    return this.notices.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '공지사항 삭제' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.notices.remove(id);
  }
}
