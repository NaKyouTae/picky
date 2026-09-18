import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 카카오 콜백 처리 요청.
 * state 검증은 쿠키를 가진 프론트(Next Route Handler)가 담당하고,
 * 서버는 code 를 교환하며 nonce / code_verifier 를 확인한다.
 */
export class KakaoCallbackDto {
  @ApiProperty({ description: '카카오가 리디렉션 쿼리로 준 인가 코드' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;

  @ApiProperty({ description: '로그인 시작 때 발급받아 쿠키에 보관한 nonce' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  nonce!: string;

  @ApiProperty({ description: 'PKCE code_verifier' })
  @IsString()
  @MinLength(43)
  @MaxLength(128)
  codeVerifier!: string;
}
