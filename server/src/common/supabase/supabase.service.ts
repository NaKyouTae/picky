import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Storage 버킷.
 * - `picky` (public): 어드민이 올리는 콜라주 템플릿. URL 이 그대로 노출돼도 되는 자산.
 * - `challenge-proofs` (private): 사용자가 올리는 챌린지 인증 사진.
 *   개인 사진이라 public URL 을 만들지 않고 짧은 signed URL 로만 읽는다.
 *   콜라주를 만든 뒤(또는 그만두기) 삭제되는 임시 파일이다.
 */
export const BUCKET = {
  assets: 'picky',
  proofs: 'challenge-proofs',
} as const;

export type BucketName = (typeof BUCKET)[keyof typeof BUCKET];

/** 인증 사진 읽기용 signed URL 유효 시간 — 콜라주를 만드는 동안만 필요하다 */
const SIGNED_URL_TTL_SECONDS = 600;

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

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

  /** public 버킷 업로드 후 public URL 반환 (콜라주 템플릿) */
  async upload(path: string, file: Buffer, contentType: string): Promise<string> {
    await this.uploadTo(BUCKET.assets, path, file, contentType);
    return this.getPublicUrl(path);
  }

  /** 버킷을 지정해 업로드한다. private 버킷은 URL 을 돌려주지 않는다. */
  async uploadTo(
    bucket: BucketName,
    path: string,
    file: Buffer,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.getClient()
      .storage.from(bucket)
      .upload(path, file, { contentType, upsert: true });

    if (error) {
      this.logger.error(`Storage upload 실패 (${bucket}/${path}): ${error.message}`);
      throw new InternalServerErrorException('파일 업로드에 실패했습니다.');
    }
  }

  getPublicUrl(path: string): string {
    return this.getClient().storage.from(BUCKET.assets).getPublicUrl(path).data.publicUrl;
  }

  /** private 버킷 읽기용 임시 URL — 만료되므로 DB 에 저장하지 않는다 */
  async createSignedUrl(bucket: BucketName, path: string): Promise<string> {
    const { data, error } = await this.getClient()
      .storage.from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !data) {
      this.logger.error(`signed URL 발급 실패 (${bucket}/${path}): ${error?.message}`);
      throw new InternalServerErrorException('이미지 주소를 만들 수 없습니다.');
    }
    return data.signedUrl;
  }

  async remove(paths: string[]): Promise<void> {
    await this.removeFrom(BUCKET.assets, paths);
  }

  /**
   * 파일 삭제.
   * 삭제 실패는 예외로 올리지 않는다 — 호출하는 쪽(콜라주 생성·그만두기)의 흐름을
   * 막지 않아야 하고, 남은 파일은 어차피 임시 파일이라 나중에 정리할 수 있다.
   */
  async removeFrom(bucket: BucketName, paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    const { error } = await this.getClient().storage.from(bucket).remove(paths);
    if (error) {
      this.logger.error(`Storage 삭제 실패 (${bucket}): ${error.message}`);
    }
  }
}
