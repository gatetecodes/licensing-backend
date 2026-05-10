export const InstitutionTypes = {
  BANK: 'BANK',
  MICROFINANCE: 'MICROFINANCE',
  INSURANCE: 'INSURANCE',
  LEASING: 'LEASING',
  OTHER: 'OTHER'
} as const;

export const ApplicationStates = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  INFO_REQUESTED: 'INFO_REQUESTED',
  RESUBMITTED: 'RESUBMITTED',
  READY_FOR_DECISION: 'READY_FOR_DECISION',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const;

export const ApplicationReviewOutcomes = {
  INFO_REQUESTED: 'INFO_REQUESTED',
  READY_FOR_DECISION: 'READY_FOR_DECISION'
} as const;

export const WorkflowRequestItemTypes = {
  FIELD_UPDATE: 'FIELD_UPDATE',
  DOCUMENT_REPLACEMENT: 'DOCUMENT_REPLACEMENT',
  ADDITIONAL_DOCUMENT: 'ADDITIONAL_DOCUMENT',
  OPEN_QUESTION: 'OPEN_QUESTION'
} as const;

export const WorkflowFieldKeys = {
  institution_name: 'institution_name',
  institution_type: 'institution_type',
  business_address: 'business_address',
  contact_name: 'contact_name',
  contact_email: 'contact_email',
  contact_phone: 'contact_phone',
  license_category: 'license_category',
  license_category_other_details: 'license_category_other_details',
  capital_amount_rwf: 'capital_amount_rwf',
  incorporation_date: 'incorporation_date',
  business_summary: 'business_summary'
} as const;

export const LicenseCategories = {
  COMMERCIAL_BANK: 'COMMERCIAL_BANK',
  MICROFINANCE_DEPOSIT_TAKING: 'MICROFINANCE_DEPOSIT_TAKING',
  MICROFINANCE_NON_DEPOSIT_TAKING: 'MICROFINANCE_NON_DEPOSIT_TAKING',
  INSURANCE_LIFE: 'INSURANCE_LIFE',
  INSURANCE_NON_LIFE: 'INSURANCE_NON_LIFE',
  PAYMENT_SERVICE_PROVIDER: 'PAYMENT_SERVICE_PROVIDER',
  LEASING_LICENSE: 'LEASING_LICENSE',
  OTHER: 'OTHER'
} as const;

export type ApplicationReviewOutcome =
  (typeof ApplicationReviewOutcomes)[keyof typeof ApplicationReviewOutcomes];
export type WorkflowRequestItemType =
  (typeof WorkflowRequestItemTypes)[keyof typeof WorkflowRequestItemTypes];
export type WorkflowFieldKey =
  (typeof WorkflowFieldKeys)[keyof typeof WorkflowFieldKeys];
export type InstitutionType =
  (typeof InstitutionTypes)[keyof typeof InstitutionTypes];
export type ApplicationState =
  (typeof ApplicationStates)[keyof typeof ApplicationStates];
export type LicenseCategory =
  (typeof LicenseCategories)[keyof typeof LicenseCategories];

export interface IWorkflowRequestItem {
  id: string;
  type: WorkflowRequestItemType;
  instruction: string;
  field_key?: WorkflowFieldKey;
  document_type?: string;
  required: boolean;
  captured_value?: string | null;
}

export interface IWorkflowResponseItem {
  request_item_id: string;
  answer_text?: string;
}

export interface ILatestInfoRequest {
  reviewer_summary_note?: string | null;
  requested_at: Date;
  request_items: IWorkflowRequestItem[];
  applicant_responses?: IWorkflowResponseItem[] | null;
  responded_at?: Date | null;
}

export interface IApplication {
  id: string;
  reference_number: string;
  applicant_id: string;
  institution_name: string;
  institution_type: InstitutionType;
  business_address?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  license_category?: LicenseCategory;
  license_category_other_details?: string;
  capital_amount_rwf?: number;
  incorporation_date?: Date;
  business_summary?: string;
  current_state: ApplicationState;
  submitted_at?: Date;
  reviewed_by_id?: string;
  decisioned_by_id?: string;
  decision_at?: Date;
  decision_reason?: string;
  latest_review?: IApplicationReview | null;
  latest_info_request?: ILatestInfoRequest | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface IApplicationCreate {
  reference_number: string;
  applicant_id: string;
  institution_name: string;
  institution_type: InstitutionType;
  business_address?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  license_category?: LicenseCategory;
  license_category_other_details?: string;
  capital_amount_rwf?: number;
  incorporation_date?: Date;
  business_summary?: string;
  current_state: ApplicationState;
}

export interface IApplicationDraftBody {
  institution_name: string;
  institution_type: InstitutionType;
  business_address?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  license_category?: LicenseCategory;
  license_category_other_details?: string;
  capital_amount_rwf?: number;
  incorporation_date?: Date;
  business_summary?: string;
}

export interface IApplicationDraftUpdateBody extends IApplicationDraftBody {
  lock_version: number;
}

export interface IWorkflowActionBody {
  lock_version: number;
}

export interface IWorkflowResponseBody extends IWorkflowActionBody {
  responses: IWorkflowResponseItem[];
}

export interface IWorkflowRequestInformationBody extends IWorkflowActionBody {
  request_items: Array<{
    type: WorkflowRequestItemType;
    instruction: string;
    field_key?: WorkflowFieldKey;
    document_type?: string;
    required?: boolean;
  }>;
  reviewer_summary_note?: string;
}

export interface IWorkflowNotesBody extends IWorkflowActionBody {
  notes: string;
}

export interface IWorkflowDecisionBody extends IWorkflowActionBody {
  decision_reason: string;
}

export interface IApplicationListQuery {
  current_state?: ApplicationState;
}

export interface IApplicationReview {
  id: string;
  application_id: string;
  reviewer_id: string;
  cycle_number: number;
  started_at: Date;
  completed_at?: Date;
  outcome?: ApplicationReviewOutcome;
  notes?: string;
  request_items?: IWorkflowRequestItem[] | null;
  applicant_responses?: IWorkflowResponseItem[] | null;
  responded_at?: Date | null;
}

export interface IApplicationReviewCreate {
  application_id: string;
  reviewer_id: string;
  cycle_number: number;
  started_at: Date;
  completed_at?: Date;
  outcome?: ApplicationReviewOutcome;
  notes?: string;
  request_items?: IWorkflowRequestItem[] | null;
  applicant_responses?: IWorkflowResponseItem[] | null;
  responded_at?: Date | null;
}
