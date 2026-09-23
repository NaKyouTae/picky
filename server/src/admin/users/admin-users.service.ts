import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Gender, ProviderType, UserRole, UserStatus } from '../../generated/prisma/enums';
import type { ListAdminUsersDto } from './dto/list-admin-users.dto';

const DEFAULT_TAKE = 20;

export interface AdminUserRow {
  id: string;
  /** 선택 동의 — 제공자에게 받지 못하면 비어 있다 */
  email: string | null;
  name: string;
  role: UserRole;
  status: UserStatus;
  /** 아래 3개는 제공자가 동의를 받지 못하면 비어 있다 */
  gender: Gender | null;
  ageRange: string | null;
  birthday: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** 연결된 SNS 제공자 목록 — 목록 화면에서 제공자별 컬럼에 로고로 표시한다 */
  providers: ProviderType[];
}

export interface AdminUserPage {
  items: AdminUserRow[];
  /** 다음 페이지 요청에 그대로 넘길 커서. null 이면 마지막 페이지 */
  nextCursor: string | null;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자 목록 (커서 기반).
   * 정렬은 createdAt 역순이며, 같은 시각이 있어도 순서가 흔들리지 않도록 id 를 보조 키로 둔다.
   * `@@index([createdAt])` 가 정렬을 커버한다.
   */
  async list({ q, cursor, take = DEFAULT_TAKE }: ListAdminUsersDto): Promise<AdminUserPage> {
    const rows = await this.prisma.user.findMany({
      // 검색어는 부분 일치라 btree 인덱스를 타지 않는다. 데이터가 커지면
      // pg_trgm GIN 인덱스를 고려할 것 (현재 규모에서는 불필요).
      ...(q
        ? {
            where: {
              OR: [
                { email: { contains: q, mode: 'insensitive' as const } },
                { name: { contains: q, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
      // 한 건 더 읽어 다음 페이지 존재 여부를 판단한다 (별도 count 쿼리 없이).
      take: take + 1,
      // skip: 1 은 offset 페이징이 아니라 커서 행 자체를 제외하기 위한 것이다.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        gender: true,
        ageRange: true,
        birthday: true,
        createdAt: true,
        updatedAt: true,
        // 관계를 select 로 함께 가져와 N+1 을 만들지 않는다 (Prisma 가 IN 쿼리로 묶는다).
        accounts: { select: { providerType: true } },
      },
    });

    const hasNext = rows.length > take;
    const page = hasNext ? rows.slice(0, take) : rows;

    return {
      items: page.map(({ accounts, ...user }) => ({
        ...user,
        providers: accounts.map((account) => account.providerType),
      })),
      nextCursor: hasNext ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
