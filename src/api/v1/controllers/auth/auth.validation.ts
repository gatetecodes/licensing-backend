import { Joi, celebrate, Segments } from 'celebrate';
import {
  passwordRegMatch,
  containSpecialCharacter
} from '../../../../helpers/common-validation';
import { Roles } from '../../../../types/role.types';

export const validateLogin = celebrate({
  [Segments.BODY]: Joi.object()
    .keys({
      email: Joi.string().required().email(),
      password: Joi.string().required()
    })
    .required()
    .options({
      abortEarly: false
    })
});

const resetPassword = {
  newPassword: Joi.string()
    .required()
    .trim(true)
    .min(8)
    .max(32)
    .regex(passwordRegMatch)
    .messages({
      'string.min': 'password must contains atleast 8 characters',
      'string.max': 'password must not exceed 32 characters',
      'string.empty': 'password is required',
      'string.pattern.base':
        'password must contain at least one uppercase, one lowercase, one number and one special character'
    }),
  confirmPassword: Joi.string().required().trim(true)
};
export const validateSetPassword = celebrate({
  [Segments.QUERY]: Joi.object().keys({
    token: Joi.string().required()
  }),
  [Segments.BODY]: Joi.object().keys(resetPassword).required().options({
    abortEarly: false
  })
});

export const validateResetPasswordToken = celebrate({
  [Segments.BODY]: Joi.object()
    .keys({
      token: Joi.string().required()
    })
    .required()
    .options({
      abortEarly: false
    })
});

export const validatePasswordSetupRequest = celebrate({
  [Segments.BODY]: Joi.object()
    .keys({
      email: Joi.string().required().email()
    })
    .required()
    .options({
      abortEarly: false
    })
});

export const validateChangePassword = celebrate({
  [Segments.BODY]: Joi.object()
    .keys({
      oldPassword: Joi.string().required().trim(true),
      ...resetPassword
    })
    .required()
    .options({
      abortEarly: false
    })
});

export const validateRegister = celebrate({
  [Segments.BODY]: Joi.object()
    .keys({
      email: Joi.string().required().email(),
      password: Joi.string()
        .min(8)
        .max(32)
        .required()
        .trim()
        .regex(passwordRegMatch)
        .messages({
          'string.min': 'password must contains atleast 8 characters',
          'string.max': 'password must not exceed 32 characters',
          'string.empty': 'password is required',
          'string.pattern.base':
            'password must contain at least one uppercase, one lowercase, one number and one special character'
        }),
      name: Joi.string()
        .required()
        .max(50)
        .custom((value, helper) => {
          if (containSpecialCharacter(value)) {
            return helper.message(
              'name must not contains any special character' as any
            );
          }
          return value;
        }),
      institution_name: Joi.string().required()
    })
    .required()
    .options({
      abortEarly: false
    })
});

export const validateVerifyEmail = celebrate({
  [Segments.BODY]: Joi.object()
    .keys({
      token: Joi.string().required()
    })
    .required()
    .options({
      abortEarly: false
    })
});

export const validateInviteInternalUser = celebrate({
  [Segments.BODY]: Joi.object()
    .keys({
      email: Joi.string().required().email(),
      name: Joi.string()
        .required()
        .max(50)
        .custom((value, helper) => {
          if (containSpecialCharacter(value)) {
            return helper.message(
              'name must not contains any special character' as any
            );
          }
          return value;
        }),
      role: Joi.string()
        .required()
        .valid(Roles.REVIEWER, Roles.APPROVER, Roles.ADMIN)
    })
    .required()
    .options({
      abortEarly: false
    })
});
