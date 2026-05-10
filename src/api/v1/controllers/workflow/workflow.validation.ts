import { Joi, celebrate, Segments } from 'celebrate';
import {
  WorkflowFieldKeys,
  WorkflowRequestItemTypes
} from '../../../../types/application.types';
import { DocumentTypes } from '../../../../types/document.types';

const applicationIdParams = {
  id: Joi.string().uuid().required()
};

const lockVersion = Joi.number().integer().min(0).required();

const requiredDocumentTypes = [
  DocumentTypes.BUSINESS_PLAN,
  DocumentTypes.CERTIFICATE_OF_INCORPORATION,
  DocumentTypes.SHAREHOLDING_STRUCTURE,
  DocumentTypes.CAPITAL_ADEQUACY_EVIDENCE,
  DocumentTypes.GOVERNANCE_DOCUMENT
];

const requestItemSchema = Joi.object()
  .keys({
    type: Joi.string()
      .valid(...Object.values(WorkflowRequestItemTypes))
      .required(),
    instruction: Joi.string().trim().required(),
    field_key: Joi.when('type', {
      is: WorkflowRequestItemTypes.FIELD_UPDATE,
      then: Joi.string()
        .valid(...Object.values(WorkflowFieldKeys))
        .required(),
      otherwise: Joi.forbidden()
    }),
    document_type: Joi.when('type', {
      switch: [
        {
          is: WorkflowRequestItemTypes.DOCUMENT_REPLACEMENT,
          then: Joi.string()
            .valid(...requiredDocumentTypes)
            .required()
        },
        {
          is: WorkflowRequestItemTypes.ADDITIONAL_DOCUMENT,
          then: Joi.string().valid(DocumentTypes.SUPPORTING_DOCUMENT).required()
        }
      ],
      otherwise: Joi.forbidden()
    }),
    required: Joi.boolean().default(true)
  })
  .required();

export const validateWorkflowAction = celebrate({
  [Segments.PARAMS]: Joi.object().keys(applicationIdParams).required(),
  [Segments.BODY]: Joi.object()
    .keys({
      lock_version: lockVersion
    })
    .required()
    .options({
      abortEarly: false
    })
});

export const validateWorkflowInformationRequest = celebrate({
  [Segments.PARAMS]: Joi.object().keys(applicationIdParams).required(),
  [Segments.BODY]: Joi.object()
    .keys({
      lock_version: lockVersion,
      request_items: Joi.array().items(requestItemSchema).min(1).required(),
      reviewer_summary_note: Joi.string().trim().allow('', null).optional()
    })
    .required()
    .options({
      abortEarly: false
    })
});

export const validateWorkflowNotes = celebrate({
  [Segments.PARAMS]: Joi.object().keys(applicationIdParams).required(),
  [Segments.BODY]: Joi.object()
    .keys({
      lock_version: lockVersion,
      notes: Joi.string().trim().required()
    })
    .required()
    .options({
      abortEarly: false
    })
});

export const validateWorkflowDecision = celebrate({
  [Segments.PARAMS]: Joi.object().keys(applicationIdParams).required(),
  [Segments.BODY]: Joi.object()
    .keys({
      lock_version: lockVersion,
      decision_reason: Joi.string().trim().required()
    })
    .required()
    .options({
      abortEarly: false
    })
});
