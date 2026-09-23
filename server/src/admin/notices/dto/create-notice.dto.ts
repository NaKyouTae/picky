import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NoticeStatus } from '../../../generated/prisma/enums';

/**
 * 공지사항 등록·수정.
 *
 * 비울 수 있는 칸(`publishedAt`)은 `null` 을 받는다 — 수정에서 생략(`undefined`)은
 * "그대로 두기" 라, 지우려면 명시적으로 null 을 보내야 한다.
 */
export class CreateNoticeDto {
  @ApiProperty({ example: '9월 26일 서비스 점검 안내', description: '목록에 보이는 제목' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    example: '더 나은 서비스를 위해 점검을 진행합니다.\n\n점검 시간: 9월 26일 02:00~04:00',
    description: '본문 — 서식 없는 글. 줄바꿈만 그대로 보인다',
  })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ enum: NoticeStatus, default: NoticeStatus.DRAFT })
  @IsOptional()
  @IsEnum(NoticeStatus)
  status?: NoticeStatus;

  @ApiPropertyOptional({ description: '목록 맨 위 고정', default: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({
    description:
      '앱에 보이는 게시 시각 (ISO). 비우면 공개로 바꾸는 순간의 시각이 들어간다. ' +
      '미래 시각을 주면 그때까지 앱에 보이지 않는다 (예약 게시)',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;
}
