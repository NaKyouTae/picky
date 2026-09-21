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

  // ':id' 보다 먼저 선언해야 이 경로들이 먼저 매칭된다.
  @Patch(':id/redraw')
  @ApiOperation({ summary: '다시 뽑기 — 현재 칸의 챌린지만 교체 (번호는 그대로)' })
  redraw(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.redraw(req.user!.sub, id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: '현재 챌린지 완료 → 다음 칸 뽑기 (5번째면 그룹 완료)' })
  complete(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.completeCurrent(req.user!.sub, id);
  }

  @Patch(':id/end')
  @ApiOperation({ summary: '그만두기 — 완료하지 않고 그룹을 닫는다' })
  end(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.end(req.user!.sub, id);
  }
}
