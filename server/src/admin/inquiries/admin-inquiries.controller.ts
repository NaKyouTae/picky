import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminInquiriesService } from './admin-inquiries.service';
import { ListAdminInquiriesDto } from './dto/list-admin-inquiries.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';

@ApiTags('admin-inquiries')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/inquiries')
export class AdminInquiriesController {
  constructor(private readonly inquiries: AdminInquiriesService) {}

  @Get()
  @ApiOperation({ summary: '문의 목록 (커서 페이지네이션)' })
  list(@Query() query: ListAdminInquiriesDto) {
    return this.inquiries.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '문의 단건 (첨부 사진 signed URL 포함)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.inquiries.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '처리 상태·관리자 메모 수정' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInquiryDto) {
    return this.inquiries.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '문의 삭제 (첨부 사진도 함께 삭제)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.inquiries.remove(id);
  }
}
