import { Module } from '@nestjs/common';
import { StickerTemplatesController } from './sticker-templates.controller';
import { StickerTemplatesService } from './sticker-templates.service';

@Module({
  controllers: [StickerTemplatesController],
  providers: [StickerTemplatesService],
})
export class StickerTemplatesModule {}
