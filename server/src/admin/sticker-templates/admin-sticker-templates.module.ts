import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminStickerTemplatesController } from './admin-sticker-templates.controller';
import { AdminStickerTemplatesService } from './admin-sticker-templates.service';

// JwtModule 은 AdminAuthModule 에서, SupabaseModule 은 @Global 로 등록돼 있어 다시 import 하지 않는다.
@Module({
  controllers: [AdminStickerTemplatesController],
  providers: [AdminStickerTemplatesService, AdminGuard],
})
export class AdminStickerTemplatesModule {}
