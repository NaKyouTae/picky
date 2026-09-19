import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StickerTemplatesService } from './sticker-templates.service';

@ApiTags('sticker-templates')
@Controller('sticker-templates')
export class StickerTemplatesController {
  constructor(private readonly templates: StickerTemplatesService) {}

  @Get()
  @ApiOperation({ summary: '공개된 스티커 템플릿 목록 (앱 스티커 탭)' })
  list() {
    return this.templates.listPublished();
  }
}
