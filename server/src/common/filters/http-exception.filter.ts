import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

/**
 * Prisma 오류를 사람이 읽을 수 있는 응답으로 옮긴다.
 *
 * 이 매핑이 없으면 어드민에는 "서버 오류가 발생했습니다." 만 뜨고, 원인(중복 값인지,
 * 마이그레이션이 안 돌았는지)은 서버 로그를 열어야만 알 수 있다 —
 * 실제로 `apple_product_id` 컬럼이 없어서 회원권 등록이 500 으로 죽는 동안 그랬다.
 */
function mapPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): { status: number; message: string } | null {
  switch (error.code) {
    case 'P2002': {
      // 유니크 제약 위반 — 어느 값이 겹쳤는지 알려 줘야 고칠 수 있다.
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(', ') : (target ?? '');
      return {
        status: HttpStatus.CONFLICT,
        message: fields
          ? `이미 사용 중인 값입니다: ${fields}`
          : '이미 같은 값이 등록되어 있습니다.',
      };
    }
    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        message: '연결된 데이터가 없어 처리할 수 없습니다.',
      };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: '대상을 찾을 수 없습니다.' };
    case 'P2021':
    case 'P2022':
      // 스키마와 DB 가 어긋난 상태 — 고칠 사람이 볼 문구라 할 일을 그대로 적는다.
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          'DB 스키마가 서버 코드보다 오래되었습니다. 마이그레이션을 적용해 주세요 (pnpm db:deploy).',
      };
    default:
      return null;
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const prisma =
      exception instanceof Prisma.PrismaClientKnownRequestError ? mapPrismaError(exception) : null;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (prisma?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (prisma?.message ?? '서버 오류가 발생했습니다.');

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, (exception as Error)?.stack);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(typeof message === 'object' ? message : { message }),
    });
  }
}
