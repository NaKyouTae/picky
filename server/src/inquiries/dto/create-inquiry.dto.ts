import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { InquiryType } from '../../generated/prisma/enums';

/** 문의 내용 상한 — 화면의 입력칸(240px)에 담기는 분량보다 넉넉하게 잡는다 */
export const MAX_INQUIRY_CONTENT = 2000;

/**
 * 문의 등록 (multipart/form-data).
 *
 * 사진은 `files` 파트로 따로 오고(최대 3장) 이 DTO 에 들어오지 않는다 —
 * multer 가 파일을 body 에서 떼어 내므로 whitelist 검증에 걸리지 않는다.
 * 나머지 값은 multipart 라 전부 문자열로 도착하는데, 셋 다 원래 문자열이라 변환이 필요 없다.
 */
export class CreateInquiryDto {
  @ApiProperty({ enum: InquiryType, description: '문의 유형 — 앱의 칩 6개와 1:1' })
  @IsEnum(InquiryType)
  type!: InquiryType;

  @ApiProperty({ example: '어쩌고 저쩌고 오류가 발생했습니다. 확인해 주세요.' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_INQUIRY_CONTENT)
  content!: string;

  @ApiProperty({ example: 'picky77@gmail.com', description: '답변을 받을 이메일 주소' })
  @IsEmail({}, { message: '이메일 주소 형식이 올바르지 않습니다.' })
  @MaxLength(255)
  email!: string;
}

/** 등록 결과 — 앱은 접수됐다는 사실만 쓰므로 id 와 시각만 돌려준다 */
export class InquiryReceiptDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  createdAt!: Date;
}
