import config from 'config';
import { celebrate, Joi, Segments } from 'celebrate';
import multer, { MulterError } from 'multer';
import { NextFunction, Request, Response } from 'express';
import { responseWrapper } from '../../../../helpers/response-wrapper';
import httpCodes from '../../../../constants/http-codes';
import { DocumentTypes } from '../../../../types/document.types';

const DEFAULT_MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024
};

const parseSizeToBytes = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    const bytes = Number(normalized);
    return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
  }

  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i);
  if (!match) {
    return null;
  }

  const [, amountRaw, unitRaw] = match;
  const amount = Number(amountRaw);
  const multiplier = SIZE_UNITS[unitRaw.toLowerCase()];

  if (!Number.isFinite(amount) || amount <= 0 || !multiplier) {
    return null;
  }

  return Math.floor(amount * multiplier);
};

const configuredMaxUploadSize = config.has('app.maxUploadSize')
  ? config.get('app.maxUploadSize')
  : undefined;

const maxUploadSize =
  parseSizeToBytes(configuredMaxUploadSize) ?? DEFAULT_MAX_UPLOAD_SIZE;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadSize
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(
        Object.assign(new Error('Only PDF documents are allowed'), {
          status: httpCodes.UNPROCESSABLE_ENTITY
        })
      );
      return;
    }

    callback(null, true);
  }
});

export const handleDocumentUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      responseWrapper({
        res,
        status: httpCodes.REQUEST_TOO_LONG,
        message: 'Document exceeds the maximum allowed size of 5 MB'
      });
      return;
    }

    const status = (error as Error & { status?: number }).status;

    responseWrapper({
      res,
      status: status || httpCodes.UNPROCESSABLE_ENTITY,
      message: error.message || 'Invalid document upload'
    });
  });
};

export const validateUploadDocument = celebrate({
  [Segments.PARAMS]: Joi.object()
    .keys({
      id: Joi.string().uuid().required()
    })
    .required(),
  [Segments.BODY]: Joi.object()
    .keys({
      document_type: Joi.string()
        .valid(...Object.values(DocumentTypes))
        .required()
    })
    .required()
    .options({
      abortEarly: false,
      allowUnknown: true
    })
});

export const validateApplicationDocumentsPath = celebrate({
  [Segments.PARAMS]: Joi.object()
    .keys({
      id: Joi.string().uuid().required()
    })
    .required()
});

export const validateDocumentVersionsPath = celebrate({
  [Segments.PARAMS]: Joi.object()
    .keys({
      documentId: Joi.string().uuid().required()
    })
    .required()
});

export const validateDocumentVersionDownloadPath = celebrate({
  [Segments.PARAMS]: Joi.object()
    .keys({
      versionId: Joi.string().uuid().required()
    })
    .required()
});
