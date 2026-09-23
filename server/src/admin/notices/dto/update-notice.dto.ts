import { PartialType } from '@nestjs/swagger';
import { CreateNoticeDto } from './create-notice.dto';

/** 공지사항 수정 — 모든 필드가 선택 */
export class UpdateNoticeDto extends PartialType(CreateNoticeDto) {}
