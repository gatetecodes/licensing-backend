export const AuditLogActionTypes = {
  APPLICATION_SUBMITTED: 'APPLICATION_SUBMITTED',
  REVIEW_STARTED: 'REVIEW_STARTED',
  MORE_INFO_REQUESTED: 'MORE_INFO_REQUESTED',
  APPLICATION_RESUBMITTED: 'APPLICATION_RESUBMITTED',
  APPLICATION_MARKED_AS_READY_FOR_DECISION:
    'APPLICATION_MARKED_AS_READY_FOR_DECISION',
  APPLICATION_APPROVED: 'APPLICATION_APPROVED',
  APPLICATION_REJECTED: 'APPLICATION_REJECTED'
} as const;

export type AuditLogActionType = (typeof AuditLogActionTypes)[keyof typeof AuditLogActionTypes];

export interface IAuditLog {
  id: string;
  application_id: string;
  acting_user_id: string;
  action_type: AuditLogActionType;
  occurred_at: Date;
  before_state?: string;
  after_state?: string;
  request_id: string;
  ip_address?: string;
  user_agent?: string;
  metadata: Record<string, any>;
  previous_hash?: string;
  entry_hash: string;
}
