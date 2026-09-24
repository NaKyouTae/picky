import { Body, Controller, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, type AuthedRequest } from '../common/guards/jwt-auth.guard';
import type { UploadedImage } from '../common/types/uploaded-image';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiriesService, MAX_INQUIRY_IMAGES } from './inquiries.service';

/** multer 단계에서 먼저 잘라내는 상한 — 서비스에서 한 번 더 확인한다 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * 문의하기 — 보내는 것만 있다.
 *
 * 답변은 관리자가 입력받은 이메일로 직접 회신하므로 앱에 문의 내역·답변 화면이 없다.
 * (내역을 보여주려면 목록 API 와 읽음 처리까지 필요한데, 지금 디자인에는 그 화면이 없다.)
 */
@ApiTags('inquiries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateInquiryDto })
  @UseInterceptors(
    FilesInterceptor('files', MAX_INQUIRY_IMAGES, { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  @ApiOperation({ summary: '문의 접수 (사진 최대 3장)' })
  create(
    @Req() req: AuthedRequest,
    @Body() dto: CreateInquiryDto,
    @UploadedFiles() files?: UploadedImage[],
  ) {
    return this.inquiries.create(req.user!.sub, dto, files ?? []);
  }
}
