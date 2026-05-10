import { Joi, celebrate } from 'celebrate';

/** Validate string params */
export const param = (input: string) =>
  celebrate({
    params: Joi.object().keys({
      [input]: Joi.string().required()
    })
  });

/** Validate UUID params */
export const uuidParam = (input: string) =>
  celebrate({
    params: Joi.object().keys({
      [input]: Joi.string().uuid().required()
    })
  });

export const validateUrl = (value?: string, message?: string) => {
  if (value && value.length > 0 && value !== '') {
    try {
      new URL(value);
      return true;
    } catch {
      throw new Error(message ?? 'Invalid URL');
    }
  }
  return true;
};

export const isEmpty = (value: any) => {
  return value
    ? value === '' || value.length === 0 || Object.values(value).length === 0
    : true;
};

export const isUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const passwordRegMatch =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])[^\s]{8,32}$/;

export const urlRegMatch =
  // eslint-disable-next-line no-useless-escape
  /^((http|https):\/\/)?(www.)?(?!.*(http|https|www.))[a-zA-Z0-9_-]+(\.[a-zA-Z]+)+(\/)?.([\w\?[a-zA-Z-_%\/@?]+)*([^\/\w\?[a-zA-Z0-9_-]+=\w+(&[a-zA-Z0-9_]+=\w+)*)?$/;

/**
 *
 * @param value
 * @description check if string contains special characters
 */
export const containSpecialCharacter = (value: string) => {
  // Allow common human name characters; reject everything else.
  const regex = /[^a-zA-Z0-9\s'-]/;

  if (isEmpty(value)) {
    return false;
  }

  const isMatch = regex.test(value);

  return isMatch;
};

export const removeSpecialCharacters = (text: string) => {
  return text.replace(/[^a-zA-Z0-9 ]/g, '');
};

export const isNumber = (value: string) => {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
};
