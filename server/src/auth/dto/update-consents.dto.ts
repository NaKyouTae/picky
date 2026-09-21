import { ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsOptional } from 'class-validator';

/**
 * 동의 변경 — 보낸 항목만 바뀐다.
 *
 * 필수 동의(이용약관·개인정보 수집·이용)는 철회하면 서비스를 이용할 수 없으므로
 * true(동의) 만 받는다. 철회는 회원 탈퇴로만 가능하다.
 */
export class UpdateConsentsDto {
  @ApiPropertyOptional({ description: '이용약관 동의 (true 만 허용)', enum: [true] })
  @IsOptional()
  @Equals(true)
  terms?: true;

  @ApiPropertyOptional({ description: '개인정보 수집·이용 동의 (true 만 허용)', enum: [true] })
  @IsOptional()
  @Equals(true)
  privacy?: true;

  @ApiPropertyOptional({ description: '마케팅 정보 수신 동의 — 철회 가능' })
  @IsOptional()
  @IsBoolean()
  marketing?: boolean;

  @ApiPropertyOptional({ description: '개인정보 제3자 제공 동의 — 철회 가능' })
  @IsOptional()
  @IsBoolean()
  thirdParty?: boolean;
}
