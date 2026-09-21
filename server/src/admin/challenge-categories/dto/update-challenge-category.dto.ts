import { PartialType } from '@nestjs/swagger';
import { CreateChallengeCategoryDto } from './create-challenge-category.dto';

/** 챌린지 카테고리 수정 — 모든 필드가 선택 */
export class UpdateChallengeCategoryDto extends PartialType(CreateChallengeCategoryDto) {}
