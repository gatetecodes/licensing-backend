export const UserAuditLogActionTypes = {
  APPLICANT_REGISTERED: 'APPLICANT_REGISTERED',
  APPLICANT_EMAIL_VERIFIED: 'APPLICANT_EMAIL_VERIFIED'
} as const;

export type UserAuditLogActionType =
  (typeof UserAuditLogActionTypes)[keyof typeof UserAuditLogActionTypes];
