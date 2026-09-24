import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Storage 버킷.
 * - `picky` (public): 어드민이 올리는 콜라주 템플릿. URL 이 그대로 노출돼도 되는 자산.
 * - `challenge-proofs` (private): 사용자가 올리는 챌린지 인증 사진.
 *   개인 사진이라 public URL 을 만들지 않고 짧은 signed URL 로만 읽는다.
 *   콜라주를 만든 뒤(또는 그만두기) 삭제되는 임시 파일이다.
 * - `collages` (private): 완성한 콜라주. **회원권이 살아 있을 때 내려받으면** 여기에 남고,
 *   '완료한 챌린지' 에서 다시 받을 수 있다. 인증 사진과 달리 임시 파일이 아니다.
 * - `inquiries` (private): 문의에 첨부한 사진. 어드민만 보는 자료라 public URL 을 만들지 않고,
 *   문의를 열 때 signed URL 을 발급한다. 문의가 지워질 때 함께 지운다.
 *
 * 버킷은 Supabase 콘솔에서 미리 만들어 둬야 한다 (넷 다 코드로 만들지 않는다).
 */
export const BUCKET = {
  assets: 'picky',
  proofs: 'challenge-proofs',
  collages: 'collages',
  inquiries: 'inquiries',
} as const;

export type BucketName = (typeof BUCKET)[keyof typeof BUCKET];

/** private 버킷 읽기용 signed URL 유효 시간 — 인증 사진 합성·콜라주 내려받기 모두 그 자리에서 쓴다 */
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

  /**
   * 여러 파일의 signed URL 을 한 번에 발급한다 ('완료한 챌린지' 목록의 콜라주 썸네일).
   *
   * 목록 한 페이지가 20건이라 파일마다 따로 부르면 요청이 20번 나간다 — Storage 의
   * 일괄 발급을 써서 한 번에 받는다. 일부가 실패해도 예외로 올리지 않는다:
   * 썸네일 하나가 비는 것은 목록 전체를 못 여는 것보다 낫다 (빠진 경로는 Map 에 없다).
   */
  async createSignedUrls(bucket: BucketName, paths: string[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (paths.length === 0) return urls;

    const { data, error } = await this.getClient()
      .storage.from(bucket)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    if (error || !data) {
      this.logger.error(`signed URL 일괄 발급 실패 (${bucket}): ${error?.message}`);
      return urls;
    }

    for (const item of data) {
      if (item.signedUrl && item.path) urls.set(item.path, item.signedUrl);
    }
    return urls;
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
