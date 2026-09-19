import { PartialType } from '@nestjs/swagger';
import { CreateStickerTemplateDto } from './create-sticker-template.dto';

/** 스티커 템플릿 수정 — 보낸 필드만 반영된다 */
export class UpdateStickerTemplateDto extends PartialType(CreateStickerTemplateDto) {}
