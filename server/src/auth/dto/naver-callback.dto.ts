import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 네이버 콜백 처리 요청.
 *
 * 네이버는 PKCE 를 지원하지 않아 code_verifier 가 없다. 대신 **state 를 두 번 쓴다** —
 * 프론트(Next Route Handler)가 쿠키와 대조해 CSRF 를 막고, 서버는 토큰 교환 때 네이버에
 * 다시 보내 같은 요청에서 나온 코드인지 확인받는다.
 */
export class NaverCallbackDto {
  @ApiProperty({ description: '네이버가 리디렉션 쿼리로 준 인가 코드' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;

  @ApiProperty({ description: '인가 요청 때 보낸 state — 토큰 교환에 함께 전송한다' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  state!: string;
}
