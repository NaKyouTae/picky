import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import type { UploadedImage } from '../../common/types/uploaded-image';
import {
  AdminStickerTemplatesService,
  MAX_IMAGE_BYTES,
} from './admin-sticker-templates.service';
import { CreateStickerTemplateDto } from './dto/create-sticker-template.dto';
import { ListAdminStickerTemplatesDto } from './dto/list-admin-sticker-templates.dto';
import { ReorderStickerTemplatesDto } from './dto/reorder-sticker-templates.dto';
import { UpdateStickerTemplateDto } from './dto/update-sticker-template.dto';

@ApiTags('admin-sticker-templates')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/sticker-templates')
export class AdminStickerTemplatesController {
  constructor(private readonly templates: AdminStickerTemplatesService) {}

  @Get()
  @ApiOperation({ summary: '스티커 템플릿 목록 (커서 페이지네이션 · 상태/제목 검색)' })
  list(@Query() query: ListAdminStickerTemplatesDto) {
    return this.templates.list(query);
  }

  /**
   * 이미지 업로드는 템플릿 저장과 분리돼 있다 — 어드민이 슬롯을 찍으려면
   * 저장 전에 이미지가 화면에 떠 있어야 하기 때문이다.
   * `:id` 라우트보다 먼저 선언할 필요는 없다 (POST 와 GET 으로 갈린다).
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: '템플릿 이미지 업로드 (PNG · JPG · WebP, 5MB 이하)' })
  uploadImage(@UploadedFile() file?: UploadedImage) {
    return this.templates.uploadImage(file);
  }

  @Get(':id')
  @ApiOperation({ summary: '스티커 템플릿 단건 조회' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.get(id);
  }

  @Post()
  @ApiOperation({ summary: '스티커 템플릿 등록' })
  create(@Body() dto: CreateStickerTemplateDto) {
    return this.templates.create(dto);
  }

  /**
   * `:id` 보다 먼저 선언해야 한다 — 뒤에 두면 ParseUUIDPipe 가 'order' 를 id 로 읽고 400 을 낸다.
   */
  @Patch('order')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '목록 순서 변경 (배열 순서대로 다시 매김)' })
  reorder(@Body() dto: ReorderStickerTemplatesDto) {
    return this.templates.reorder(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '스티커 템플릿 수정' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStickerTemplateDto) {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '스티커 템플릿 삭제 (Storage 이미지도 함께 삭제)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.remove(id);
  }
}
