import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UploadedImage } from '../common/types/uploaded-image';
import { JwtAuthGuard, type AuthedRequest } from '../common/guards/jwt-auth.guard';
import { ChallengeGroupsService } from './challenge-groups.service';
import { ChallengeSlotDto } from './dto/challenge-slot.dto';
import { ListChallengeGroupsDto } from './dto/list-challenge-groups.dto';
import { StartChallengeGroupDto } from './dto/start-challenge-group.dto';

/** multer 단계에서 먼저 잘라내는 상한 — 서비스에서 한 번 더 확인한다 */
const MAX_PROOF_UPLOAD_BYTES = 5 * 1024 * 1024;

@ApiTags('challenge-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('challenge-groups')
export class ChallengeGroupsController {
  constructor(private readonly groups: ChallengeGroupsService) {}

  @Get('active')
  @ApiOperation({ summary: '진행 중인 챌린지 그룹 전부 (카테고리당 최대 1개, 없으면 빈 배열)' })
  active(@Req() req: AuthedRequest) {
    return this.groups.active(req.user!.sub);
  }

  @Get('history')
  @ApiOperation({ summary: '완료한 챌린지 내역 (최신순, 커서 기반)' })
  history(@Req() req: AuthedRequest, @Query() dto: ListChallengeGroupsDto) {
    return this.groups.history(req.user!.sub, dto);
  }

  @Post()
  @ApiOperation({
    summary: '카테고리를 골라 그룹 시작 — 같은 카테고리가 진행 중이면 409(restart 로 교체)',
  })
  start(@Req() req: AuthedRequest, @Body() dto: StartChallengeGroupDto) {
    return this.groups.start(req.user!.sub, dto);
  }

  // ':id' 보다 먼저 선언해야 이 경로들이 먼저 매칭된다.
  @Patch(':id/redraw')
  @ApiOperation({ summary: '다시 뽑기 — 그 칸의 챌린지만 교체 (기본은 진행 중인 칸)' })
  redraw(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ChallengeSlotDto,
  ) {
    return this.groups.redraw(req.user!.sub, id, dto);
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: '챌린지 완료 → 다음 칸 뽑기 (5번째면 그룹 완료). 이미 끝낸 칸이면 그대로 둔다',
  })
  complete(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ChallengeSlotDto,
  ) {
    return this.groups.completeCurrent(req.user!.sub, id, dto);
  }

  @Patch(':id/end')
  @ApiOperation({ summary: '그만두기 — 그룹을 닫고 인증 사진을 모두 버린다' })
  end(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.end(req.user!.sub, id);
  }

  @Post(':id/proof')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PROOF_UPLOAD_BYTES } }))
  @ApiOperation({ summary: '인증 사진 업로드 (임시 저장 — 콜라주 후 삭제). 기본은 진행 중인 칸' })
  uploadProof(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ChallengeSlotDto,
    @UploadedFile() file?: UploadedImage,
  ) {
    return this.groups.uploadProof(req.user!.sub, id, file, dto);
  }

  @Get(':id/proofs')
  @ApiOperation({ summary: '콜라주 합성용 인증 사진 주소 (짧은 signed URL)' })
  proofs(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.proofUrls(req.user!.sub, id);
  }

  @Delete(':id/proofs')
  @ApiOperation({ summary: '인증 사진 버리기 — 콜라주를 만든 뒤 호출한다' })
  discardProofs(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.discardProofs(id, req.user!.sub);
  }

  // 위의 ':id/…' 경로들보다 뒤에 선언한다 — 먼저 두면 그것들을 모두 삼킨다.
  @Get(':id')
  @ApiOperation({ summary: '그룹 하나 (끝난 그룹도 조회된다 — 콜라주에서 되돌아올 때 쓴다)' })
  one(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.one(req.user!.sub, id);
  }
}
