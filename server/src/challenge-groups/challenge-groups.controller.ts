import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type AuthedRequest } from '../common/guards/jwt-auth.guard';
import { ChallengeGroupsService } from './challenge-groups.service';
import { FinishChallengeGroupDto } from './dto/finish-challenge-group.dto';
import { StartChallengeGroupDto } from './dto/start-challenge-group.dto';

@ApiTags('challenge-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('challenge-groups')
export class ChallengeGroupsController {
  constructor(private readonly groups: ChallengeGroupsService) {}

  @Get('active')
  @ApiOperation({ summary: '진행 중인 챌린지 그룹 (없으면 null)' })
  active(@Req() req: AuthedRequest) {
    return this.groups.active(req.user!.sub);
  }

  @Post()
  @ApiOperation({ summary: '카테고리를 골라 그룹 시작 — 진행 중이면 409(restart 로 교체)' })
  start(@Req() req: AuthedRequest, @Body() dto: StartChallengeGroupDto) {
    return this.groups.start(req.user!.sub, dto);
  }

  // ':id' 보다 먼저 선언해야 이 경로가 먼저 매칭된다.
  @Patch(':id/draw')
  @ApiOperation({ summary: '다음 챌린지 뽑아 그룹에 담기 (최대 5개, 담긴 건 다시 안 나옴)' })
  draw(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.drawNext(req.user!.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '진행 중인 그룹을 완료하거나 그만두기' })
  finish(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinishChallengeGroupDto,
  ) {
    return this.groups.finish(req.user!.sub, id, dto);
  }
}
