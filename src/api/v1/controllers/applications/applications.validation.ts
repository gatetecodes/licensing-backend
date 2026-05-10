import { Joi, celebrate, Segments } from 'celebrate';
import {
  ApplicationStates,
  InstitutionTypes,
  LicenseCategories
} from '../../../../types/application.types';

const applicationIdParams = {
  id: Joi.string().uuid().required()
};

const lockVersion = Joi.number().integer().min(0).required();
const optionalDraftFields = {
  business_address: Joi.string().trim().allow(null, '').optional(),
  contact_name: Joi.string().trim().allow(null, '').optional(),
  contact_email: Joi.string().email().trim().allow(null, '').optional(),
  contact_phone: Joi.string().trim().allow(null, '').optional(),
  license_category: Joi.string()
    .valid(...Object.values(LicenseCategories), null, '')
    .optional(),
  license_category_other_details: Joi.when('license_category', {
    is: LicenseCategories.OTHER,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().trim().allow(null, '').optional()
  }),
  capital_amount_rwf: Joi.number().min(0).allow(null, '').optional(),
  incorporation_date: Joi.date().iso().allow(null, '').optional(),
  business_summary: Joi.string().trim().allow(null, '').optional()
};

export const validateCreateApplication = celebrate({
  [Segments.BODY]: Joi.object()
    .keys({
      institution_name: Joi.string().trim().required(),
      institution_type: Joi.string()
        .valid(...Object.values(InstitutionTypes))
        .required(),
      ...optionalDraftFields
    })
    .required()
    .options({
      abortEarly: false
    })
});

export const validateListApplications = celebrate({
  [Segments.QUERY]: Joi.object()
    .keys({
      current_state: Joi.string().valid(...Object.values(ApplicationStates))
    })
    .options({
      abortEarly: false
    })
});

export const validateApplicationId = celebrate({
  [Segments.PARAMS]: Joi.object().keys(applicationIdParams).required()
});

export const validateUpdateDraft = celebrate({
  [Segments.PARAMS]: Joi.object().keys(applicationIdParams).required(),
  [Segments.BODY]: Joi.object()
    .keys({
      institution_name: Joi.string().trim().required(),
      institution_type: Joi.string()
        .valid(...Object.values(InstitutionTypes))
        .required(),
      ...optionalDraftFields,
      lock_version: lockVersion
    })
    .required()
    .options({
      abortEarly: false
    })
});

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

export const validateWorkflowResubmit = celebrate({
  [Segments.PARAMS]: Joi.object().keys(applicationIdParams).required(),
  [Segments.BODY]: Joi.object()
    .keys({
      lock_version: lockVersion,
      responses: Joi.array()
        .items(
          Joi.object()
            .keys({
              request_item_id: Joi.string().trim().required(),
              answer_text: Joi.string().trim().allow('', null).optional()
            })
        )
        .min(0)
        .required()
    })
    .required()
    .options({
      abortEarly: false
    })
});
