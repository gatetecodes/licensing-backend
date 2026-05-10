import { RoleType } from "./role.types";
import {
  IWorkflowRequestItem,
  IWorkflowResponseItem
} from './application.types';

export type WorkflowContext = {
  actingUserId: string;
  actingRole: RoleType;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type WorkflowActionInput = WorkflowContext & {
  applicationId: string;
  lockVersion: number;
};

export type WorkflowRequestItemInput = Omit<IWorkflowRequestItem, 'id' | 'required'> & {
  id?: string;
  required?: boolean;
};

export type WorkflowNotesInput = WorkflowActionInput & {
  requestItems: WorkflowRequestItemInput[];
  reviewerSummaryNote?: string;
};

export type WorkflowResubmitInput = WorkflowActionInput & {
  responses: IWorkflowResponseItem[];
};

export type WorkflowReadyForDecisionInput = WorkflowActionInput & {
  notes: string;
};

export type WorkflowDecisionInput = WorkflowActionInput & {
  decisionReason: string;
};

export type AuditMetadata = Record<string, unknown>;
