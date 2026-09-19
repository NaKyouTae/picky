import { PartialType } from '@nestjs/swagger';
import { CreateChallengeDto } from './create-challenge.dto';

/** 챌린지 수정 — 보낸 필드만 반영된다 */
export class UpdateChallengeDto extends PartialType(CreateChallengeDto) {}
