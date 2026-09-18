import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  private get bucket(): string {
    return this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'picky';
  }

  /** 실제 사용 시점에 생성 (환경변수 미설정 상태에서도 서버는 기동) */
  getClient(): SupabaseClient {
    if (this.client) return this.client;

    const url = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.',
      );
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.client;
  }

  /** Storage 업로드 후 public URL 반환 */
  async upload(path: string, file: Buffer, contentType: string): Promise<string> {
    const { error } = await this.getClient()
      .storage.from(this.bucket)
      .upload(path, file, { contentType, upsert: true });

    if (error) {
      this.logger.error(`Storage upload 실패: ${error.message}`);
      throw new InternalServerErrorException('파일 업로드에 실패했습니다.');
    }

    return this.getPublicUrl(path);
  }

  getPublicUrl(path: string): string {
    return this.getClient().storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  async remove(paths: string[]): Promise<void> {
    const { error } = await this.getClient().storage.from(this.bucket).remove(paths);
    if (error) {
      this.logger.error(`Storage 삭제 실패: ${error.message}`);
    }
  }
}
