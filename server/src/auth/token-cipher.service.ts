import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
/** GCM 권장 IV 길이 */
const IV_BYTES = 12;
/** 저장 형식이 바뀌면 올린다 — 옛 값을 알아보고 넘길 수 있도록 앞에 붙여 둔다 */
const VERSION = 'v1';
/** scrypt salt — 비밀이 아니라 같은 비밀에서 늘 같은 키가 나오게 하는 고정값이다 */
const KEY_SALT = 'picky.account-token';

/**
 * DB 에 보관하는 제공자 토큰 암·복호화 (AES-256-GCM).
 *
 * 네이버 연결 해제 API 는 그 사용자의 토큰을 요구해서 갱신 토큰을 보관할 수밖에 없는데,
 * 평문으로 두면 DB 만 새어도 남의 네이버 계정에 우리 앱 권한으로 접근할 수 있게 된다.
 * 그래서 컬럼에는 암호문만 넣고, 열쇠는 서버 환경변수에만 둔다.
 *
 * 키는 `TOKEN_ENCRYPTION_KEY` 에서 파생한다. 없으면 `JWT_SECRET` 으로 대신한다 —
 * 값을 따로 두지 않아도 동작하게 하기 위한 것이고, 운영에서는 따로 두는 편이 낫다.
 * **비밀을 바꾸면 이미 저장된 토큰은 복호화되지 않는다** — 그때는 연결 해제가
 * 자동으로 되지 않고 사용자에게 직접 해제하도록 안내하는 쪽으로 떨어진다(탈퇴 자체는 된다).
 */
@Injectable()
export class TokenCipherService {
  private readonly logger = new Logger(TokenCipherService.name);
  /** scrypt 는 일부러 느리게 만든 함수라 매번 돌리지 않고 한 번만 파생한다 */
  private derived: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  private get key(): Buffer {
    if (!this.derived) {
      const secret =
        this.config.get<string>('TOKEN_ENCRYPTION_KEY')?.trim() ||
        this.config.getOrThrow<string>('JWT_SECRET');
      this.derived = scryptSync(secret, KEY_SALT, 32);
    }
    return this.derived;
  }

  /** `v1.<iv>.<tag>.<ciphertext>` — 모두 base64url 이라 그대로 컬럼에 넣을 수 있다 */
  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

    return [
      VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  /**
   * 복호화 — 실패하면 null.
   *
   * 형식이 다르거나(옛 값), 비밀이 바뀌어 인증 태그가 맞지 않는 경우다.
   * 토큰은 '있으면 좋은' 값이라 throw 하지 않고 없는 것으로 취급한다.
   */
  decrypt(value: string): string | null {
    const [version, iv, tag, payload] = value.split('.');
    if (version !== VERSION || !iv || !tag || !payload) {
      this.logger.warn('알 수 없는 형식의 암호문입니다 — 토큰이 없는 것으로 처리합니다.');
      return null;
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(payload, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // 인증 태그 불일치 — 비밀이 바뀌었거나 값이 손상됐다.
      this.logger.warn('토큰을 복호화하지 못했습니다 (비밀이 바뀌었을 수 있습니다).');
      return null;
    }
  }
}
