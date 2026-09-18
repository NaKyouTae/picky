import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'spectrum', description: '관리자 아이디' })
  @IsString()
  @IsNotEmpty({ message: '아이디를 입력해 주세요.' })
  @MaxLength(100)
  username!: string;

  @ApiProperty({ example: '********', description: '관리자 비밀번호' })
  @IsString()
  @IsNotEmpty({ message: '비밀번호를 입력해 주세요.' })
  @MaxLength(200)
  password!: string;
}
