export const AuthTokenTypes = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_SETUP: 'PASSWORD_SETUP'
} as const;

export type AuthTokenType =
  (typeof AuthTokenTypes)[keyof typeof AuthTokenTypes];

export interface AuthToken {
  id: string;
  user_id: string;
  token_hash: string;
  token_type: AuthTokenType;
  expires_at: Date;
  consumed_at?: Date;
  created_at: Date;
}
