import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminChallengeCategoriesService } from './admin-challenge-categories.service';
import { CreateChallengeCategoryDto } from './dto/create-challenge-category.dto';
import { UpdateChallengeCategoryDto } from './dto/update-challenge-category.dto';

@ApiTags('admin-challenge-categories')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/challenge-categories')
export class AdminChallengeCategoriesController {
  constructor(private readonly categories: AdminChallengeCategoriesService) {}

  @Get()
  @ApiOperation({ summary: '카테고리 전체 목록' })
  list() {
    return this.categories.list();
  }

  @Get(':id')
  @ApiOperation({ summary: '카테고리 단건' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.get(id);
  }

  @Post()
  @ApiOperation({ summary: '카테고리 등록' })
  create(@Body() dto: CreateChallengeCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '카테고리 수정' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChallengeCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '카테고리 삭제 (연결된 챌린지·그룹이 없을 때만)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}
