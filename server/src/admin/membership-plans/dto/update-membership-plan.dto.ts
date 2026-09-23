import { PartialType } from '@nestjs/swagger';
import { CreateMembershipPlanDto } from './create-membership-plan.dto';

/** 회원권 수정 — 보낸 필드만 반영된다 */
export class UpdateMembershipPlanDto extends PartialType(CreateMembershipPlanDto) {}
