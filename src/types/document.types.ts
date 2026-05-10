export const DocumentTypes = {
  BUSINESS_PLAN: 'BUSINESS_PLAN',
  CERTIFICATE_OF_INCORPORATION: 'CERTIFICATE_OF_INCORPORATION',
  SHAREHOLDING_STRUCTURE: 'SHAREHOLDING_STRUCTURE',
  CAPITAL_ADEQUACY_EVIDENCE: 'CAPITAL_ADEQUACY_EVIDENCE',
  GOVERNANCE_DOCUMENT: 'GOVERNANCE_DOCUMENT',
  SUPPORTING_DOCUMENT: 'SUPPORTING_DOCUMENT'
} as const;

export type DocumentType = (typeof DocumentTypes)[keyof typeof DocumentTypes];

export interface IDocument {
  id: string;
  application_id: string;
  document_type: DocumentType;
  created_at: Date;
}

export interface IDocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  stored_filename: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  checksum: string;
  uploaded_by_id: string;
  uploaded_at: Date;
  supersedes_version_id?: string;
}

export interface IUploadDocumentBody {
  document_type: DocumentType;
}

export interface IDocumentVersionSummary {
  id: string;
  document_id: string;
  version_number: number;
  stored_filename: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  checksum: string;
  uploaded_by_id: string;
  uploaded_at: Date;
  supersedes_version_id?: string;
}

export interface IDocumentSummary {
  id: string;
  application_id: string;
  document_type: DocumentType;
  created_at: Date;
  latest_version?: IDocumentVersionSummary | null;
  versions_count?: number;
}

export type SavedDocumentFile = {
  storedFilename: string;
  checksum: string;
  absolutePath: string;
};

export type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};
