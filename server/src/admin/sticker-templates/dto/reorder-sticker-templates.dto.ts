import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** 한 번에 순서를 매길 수 있는 템플릿 수 — 목록을 통째로 보내는 구조라 상한을 둔다 */
export const MAX_REORDER = 500;

/** 스티커 템플릿 순서 변경 — 배열에 담긴 순서가 곧 노출 순서가 된다 */
export class ReorderStickerTemplatesDto {
  @ApiProperty({
    type: [String],
    description: '새 순서대로 나열한 템플릿 id 전체. 앞에 있을수록 앱에서 먼저 보인다.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REORDER)
  // 같은 id 가 두 번 오면 어느 자리로 보낼지 정할 수 없다
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids!: string[];
}
