import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminChallengesService } from './admin-challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { ListAdminChallengesDto } from './dto/list-admin-challenges.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';

@ApiTags('admin-challenges')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/challenges')
export class AdminChallengesController {
  constructor(private readonly challenges: AdminChallengesService) {}

  @Get()
  @ApiOperation({ summary: '챌린지 목록 (커서 페이지네이션 · 카테고리/상태/제목 검색)' })
  list(@Query() query: ListAdminChallengesDto) {
    return this.challenges.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '챌린지 단건 조회' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.get(id);
  }

  @Post()
  @ApiOperation({ summary: '챌린지 등록' })
  create(@Body() dto: CreateChallengeDto) {
    return this.challenges.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '챌린지 수정' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChallengeDto) {
    return this.challenges.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '챌린지 삭제' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.remove(id);
  }
}
