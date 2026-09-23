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
import { AdminMembershipPlansService } from './admin-membership-plans.service';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';

@ApiTags('admin-membership-plans')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/membership-plans')
export class AdminMembershipPlansController {
  constructor(private readonly plans: AdminMembershipPlansService) {}

  @Get()
  @ApiOperation({ summary: '회원권 전체 목록' })
  list() {
    return this.plans.list();
  }

  @Get(':id')
  @ApiOperation({ summary: '회원권 단건' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.get(id);
  }

  @Post()
  @ApiOperation({ summary: '회원권 등록' })
  create(@Body() dto: CreateMembershipPlanDto) {
    return this.plans.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '회원권 수정' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipPlanDto) {
    return this.plans.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '회원권 삭제' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.remove(id);
  }
}
