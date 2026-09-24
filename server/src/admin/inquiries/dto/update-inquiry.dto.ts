import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { InquiryStatus } from '../../../generated/prisma/enums';

/**
 * 문의 처리 상태 수정.
 *
 * 문의 내용 자체는 사용자가 보낸 글이라 고칠 수 없다 — 관리자가 바꾸는 것은
 * 상태와 메모 두 가지뿐이다. 메모를 비우려면 빈 문자열을 보낸다 (생략은 '그대로 두기').
 */
export class UpdateInquiryDto {
  @ApiPropertyOptional({ enum: InquiryStatus })
  @IsOptional()
  @IsEnum(InquiryStatus)
  status?: InquiryStatus;

  @ApiPropertyOptional({ description: '관리자 메모 — 회신 내용·처리 경위 (사용자에게 보이지 않음)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminNote?: string;
}
