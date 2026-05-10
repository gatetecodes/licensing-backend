export const Tables = {
  User: 'users',
  Role: 'roles',
  Application: 'applications',
  UserRole: 'user_roles',
  ApplicationReview: 'application_reviews',
  Document: 'documents',
  DocumentVersion: 'document_versions',
  AuditLog: 'audit_logs',
  Session: 'sessions',
  AuthToken: 'auth_tokens'
} as const;

export type Table = (typeof Tables)[keyof typeof Tables];
