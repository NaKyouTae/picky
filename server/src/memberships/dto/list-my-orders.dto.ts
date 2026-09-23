import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** 내 결제 내역 조회 (커서 기반) */
export class ListMyOrdersDto {
  @ApiPropertyOptional({ description: '이전 응답의 nextCursor (마지막 행의 id)' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ description: '한 페이지 크기', default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number;
}
