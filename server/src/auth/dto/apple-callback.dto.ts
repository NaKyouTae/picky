import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 애플 콜백 처리 요청.
 *
 * state 대조는 프론트(Next Route Handler)가 쿠키로 끝낸다 — 애플은 네이버처럼 토큰 교환에
 * state 를 다시 요구하지 않는다.
 *
 * `name` 은 **최초 인가 때 단 한 번만** 애플이 콜백 폼의 `user` 필드로 보내 준다.
 * 그 뒤로는 어디에서도 이름을 받을 수 없으므로, 이때 받아 두지 않으면 영영 모른다.
 */
export class AppleCallbackDto {
  @ApiProperty({ description: '애플이 콜백 폼으로 준 인가 코드' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;

  @ApiPropertyOptional({
    description: '최초 인가 때만 오는 사용자 이름 — 이후 로그인에는 없다',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
