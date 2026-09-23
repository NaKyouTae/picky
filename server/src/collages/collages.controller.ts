import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type AuthedRequest } from '../common/guards/jwt-auth.guard';
import type { UploadedImage } from '../common/types/uploaded-image';
import { CollagesService, MAX_COLLAGE_BYTES } from './collages.service';

@ApiTags('collages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('collages')
export class CollagesController {
  constructor(private readonly collages: CollagesService) {}

  @Post(':groupId')
  @ApiConsumes('multipart/form-data')
  // multer 단계에서 먼저 잘라내는 상한 — 서비스에서 한 번 더 확인한다
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_COLLAGE_BYTES } }))
  @ApiOperation({
    summary: '완성한 콜라주 보관 (회원 등급 무관)',
    description:
      "앱의 '콜라주 완성' 이 부른다. 그룹당 한 장이라 다시 올리면 갈아 끼운다. " +
      '회원권은 보관이 아니라 다시 내려받을 때만 확인한다.',
  })
  save(
    @Req() req: AuthedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @UploadedFile() file?: UploadedImage,
  ) {
    return this.collages.save(req.user!.sub, groupId, file);
  }

  @Get(':groupId/download')
  @ApiOperation({
    summary: '보관한 콜라주 다시 내려받기 (유료 회원 전용, 짧은 signed URL)',
    description:
      "'완료한 챌린지' 화면이 부른다. 회원권이 없거나 기간이 끝났으면 403 — 다시 구매해야 받을 수 있다.",
  })
  download(@Req() req: AuthedRequest, @Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.collages.downloadUrl(req.user!.sub, groupId);
  }
}
