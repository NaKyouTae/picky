import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MembershipOrderStatus } from '../../../generated/prisma/enums';

/** 관리자 결제 내역 조회 조건 (커서 기반 페이지네이션) */
export class ListAdminMembershipOrdersDto {
  @ApiPropertyOptional({ description: '구매자 이름·이메일 또는 주문번호 부분 검색' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: MembershipOrderStatus, description: '결제 상태 필터' })
  @IsOptional()
  @IsEnum(MembershipOrderStatus)
  status?: MembershipOrderStatus;

  // 문자열 그대로 받아 'true'/'false' 만 허용한다. boolean 으로 선언하면 전역 ValidationPipe 의
  // 암묵 변환이 먼저 일어나 'maybe' 같은 값도 통과해 버린다.
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: '이용 중인 회원권만 — 승인됐고 종료일이 아직 지나지 않은 건',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';

  @ApiPropertyOptional({ description: '이전 응답의 nextCursor (마지막 행의 id)' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ description: '한 페이지 크기', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
