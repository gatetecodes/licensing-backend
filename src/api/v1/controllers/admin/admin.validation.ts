import { celebrate, Joi, Segments } from 'celebrate';
import { Roles } from '../../../../types/role.types';
import { UserStatus } from '../../../../types/user.types';

export const validateListInternalUsers = celebrate({
  [Segments.QUERY]: Joi.object()
    .keys({
      status: Joi.string().valid(UserStatus.ACTIVE, UserStatus.DISABLED),
      role: Joi.string().valid(
        Roles.REVIEWER,
        Roles.APPROVER,
        Roles.ADMIN,
        Roles.SUPER_ADMIN
      )
    })
    .options({
      abortEarly: false
    })
});

export const validateUpdateInternalUserStatus = celebrate({
  [Segments.PARAMS]: Joi.object()
    .keys({
      id: Joi.string().uuid().required()
    })
    .required(),
  [Segments.BODY]: Joi.object()
    .keys({
      status: Joi.string()
        .valid(UserStatus.ACTIVE, UserStatus.DISABLED)
        .required()
    })
    .required()
    .options({
      abortEarly: false
    })
});
