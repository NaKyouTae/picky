import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 카카오 콜백 처리 요청.
 * state 검증은 쿠키를 가진 프론트(Next Route Handler)가 담당하고,
 * 서버는 code 를 code_verifier 와 함께 교환한다.
 * (OIDC 를 쓰지 않으므로 nonce 가 없다.)
 */
export class KakaoCallbackDto {
  @ApiProperty({ description: '카카오가 리디렉션 쿼리로 준 인가 코드' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;

  @ApiProperty({ description: 'PKCE code_verifier' })
  @IsString()
  @MinLength(43)
  @MaxLength(128)
  codeVerifier!: string;
}
