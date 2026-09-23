import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * App Store Server Notifications V2 의 본문.
 *
 * 필드는 `signedPayload` 하나뿐이고, 내용은 전부 그 안에 서명되어 들어 있다.
 * 누구나 이 주소로 POST 할 수 있으므로 **서명 검증이 곧 인증이다.**
 */
export class AppleNotificationDto {
  @ApiProperty({
    description: 'Apple 이 서명한 알림 페이로드(JWS). 서버가 서명을 검증한 뒤에만 신뢰한다.',
    example: 'eyJhbGciOiJFUzI1NiIsIng1YyI6W...',
  })
  @IsString()
  @MinLength(1)
  signedPayload!: string;
}
