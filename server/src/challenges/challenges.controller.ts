import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChallengesService } from './challenges.service';
import { RandomChallengeDto } from './dto/random-challenge.dto';

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get('categories')
  @ApiOperation({ summary: '앱 메인에 나열할 카테고리 (공개 챌린지 수 포함)' })
  categories() {
    return this.challenges.categories();
  }

  @Get('random')
  @ApiOperation({ summary: '카테고리 안에서 챌린지 하나를 랜덤으로 뽑기' })
  random(@Query() query: RandomChallengeDto) {
    return this.challenges.random(query);
  }
}
