import { promises as fs } from 'fs';
import { NextFunction, Response } from 'express';
import { ValidationError } from 'sequelize';
import {
  applicationRepository,
  documentRepository,
  documentVersionRepository,
  sequelize
} from '../../../database/sequelize';
import { BaseRepository } from './base.repository';
import DocumentModel from '../../../database/models/document.model';
import DocumentVersionModel from '../../../database/models/document-version.model';
import { AuthenticatedRequest } from '../../../types/common.types';
import { responseWrapper } from '../../../helpers/response-wrapper';
import { logger, log } from '../../../helpers/logger-helper';
import { LoggerEvents } from '../../../constants/logger-events';
import httpCodes from '../../../constants/http-codes';
import { ApplicationStates } from '../../../types/application.types';
import {
  IDocumentSummary,
  IDocumentVersionSummary,
  IUploadDocumentBody
} from '../../../types/document.types';
import DocumentStorageService from '../../../services/document-storage.service';
import { UploadedFile } from '../../../types/document.types';
import { getReadableApplication } from '../../../helpers/application-access.helper';
import { invalidateApplicationReadCaches } from '../../../helpers/application-cache.helper';

const sanitizeDocumentVersion = (
  version: DocumentVersionModel
): IDocumentVersionSummary => ({
  id: version.id,
  document_id: version.document_id,
  version_number: version.version_number,
  stored_filename: version.stored_filename,
  original_filename: version.original_filename,
  mime_type: version.mime_type,
  file_size_bytes: version.file_size_bytes,
  checksum: version.checksum,
  uploaded_by_id: version.uploaded_by_id,
  uploaded_at: version.uploaded_at,
  supersedes_version_id: version.supersedes_version_id
});

const sanitizeDocument = (
  document: DocumentModel,
  latestVersion?: DocumentVersionModel | null,
  versionsCount?: number
): IDocumentSummary => ({
  id: document.id,
  application_id: document.application_id,
  document_type: document.document_type,
  created_at: document.created_at,
  latest_version: latestVersion ? sanitizeDocumentVersion(latestVersion) : null,
  versions_count: versionsCount
});

export class DocumentsRepository extends BaseRepository<DocumentModel> {
  private readonly storageService: DocumentStorageService;

  constructor() {
    super(documentRepository);
    this.storageService = new DocumentStorageService();
  }

  /**
   * @description Upload a document
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - A promise that resolves to void
   */

  public uploadDocument = async (
    req: AuthenticatedRequest<{ id: string }, IUploadDocumentBody> & {
      file?: UploadedFile;
    },
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.DOCUMENT_UPLOAD_INIT,
        payload: {
          params: req.params,
          body: req.body,
          file: req.file
            ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                bufferLength: req.file.buffer?.length ?? 0
              }
            : null
        },
        user: req.user,
        requestId: req.requestId
      })
    );
    let storedFilename: string | undefined;

    try {
      if (!req.file) {
        responseWrapper({
          res,
          status: httpCodes.UNPROCESSABLE_ENTITY,
          message: 'A PDF document file is required'
        });
        return;
      }

      const application = await applicationRepository.findByPk(req.params.id);

      if (!application || application.applicant_id !== req.user?.id) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'Application not found'
        });
        return;
      }

      if (
        application.current_state !== ApplicationStates.DRAFT &&
        application.current_state !== ApplicationStates.INFO_REQUESTED
      ) {
        responseWrapper({
          res,
          status: httpCodes.CONFLICT,
          message:
            'Documents can only be uploaded while drafting or responding to requested information'
        });
        return;
      }

      const file = req.file;
      const fileByteLength = file.buffer?.length ?? 0;
      if (fileByteLength === 0) {
        responseWrapper({
          res,
          status: httpCodes.UNPROCESSABLE_ENTITY,
          message:
            'Uploaded file is empty. Please select a non-empty PDF and try again.'
        });
        return;
      }

      const savedFile = await this.storageService.saveFile(
        file.buffer,
        file.originalname
      );
      storedFilename = savedFile.storedFilename;

      const documentSummary = await sequelize.transaction(
        async (transaction) => {
          let document = await documentRepository.findOne({
            where: {
              application_id: application.id,
              document_type: req.body.document_type
            },
            transaction
          });

          if (!document) {
            document = await documentRepository.create(
              {
                application_id: application.id,
                document_type: req.body.document_type
              } as any,
              { transaction }
            );
          }

          const latestVersion = await documentVersionRepository.findOne({
            where: {
              document_id: document.id
            },
            order: [['version_number', 'DESC']],
            transaction
          });

          const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

          const newVersion = await documentVersionRepository.create(
            {
              document_id: document.id,
              version_number: nextVersionNumber,
              stored_filename: savedFile.storedFilename,
              original_filename: file.originalname,
              mime_type: file.mimetype,
              file_size_bytes: fileByteLength,
              checksum: savedFile.checksum,
              uploaded_by_id: req.user!.id,
              uploaded_at: new Date(),
              supersedes_version_id: latestVersion?.id
            },
            { transaction }
          );

          return sanitizeDocument(document, newVersion, nextVersionNumber);
        }
      );

      await invalidateApplicationReadCaches(application.id);

      logger.info(
        log({
          event: LoggerEvents.DOCUMENT_UPLOAD_SUCCESS,
          data: {
            applicationId: application.id,
            documentType: req.body.document_type
          },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Document uploaded successfully',
        data: {
          document: documentSummary
        }
      });
      return;
    } catch (error) {
      if (storedFilename) {
        await this.storageService
          .removeFile(storedFilename)
          .catch(() => undefined);
      }

      logger.error(
        log({
          event: LoggerEvents.DOCUMENT_UPLOAD_FAILED,
          payload: {
            params: req.params,
            body: req.body
          },
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      if (error instanceof ValidationError) {
        const details = error.errors
          .map((item) => item.message)
          .filter(Boolean)
          .join('; ');
        responseWrapper({
          res,
          status: httpCodes.UNPROCESSABLE_ENTITY,
          message:
            details ||
            'Document upload validation failed. Please verify your document details and try again.'
        });
        return;
      }
      return next(error);
    }
  };

  /**
   * @description Get all documents for an application
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - A promise that resolves to void
   */

  public readonly getApplicationDocuments = async (
    req: AuthenticatedRequest<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.DOCUMENT_LIST_INIT,
        payload: req.params,
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const application = await getReadableApplication(req, req.params.id);
      const applicationDocuments = await documentRepository.findAll({
        where: { application_id: application.id },
        order: [['created_at', 'ASC']]
      });

      const items = await Promise.all(
        applicationDocuments.map(async (document) => {
          const latestVersion = await documentVersionRepository.findOne({
            where: { document_id: document.id },
            order: [['version_number', 'DESC']]
          });

          const versionsCount = await documentVersionRepository.count({
            where: { document_id: document.id }
          });

          return sanitizeDocument(document, latestVersion, versionsCount);
        })
      );

      logger.info(
        log({
          event: LoggerEvents.DOCUMENT_LIST_SUCCESS,
          data: {
            applicationId: application.id,
            count: items.length
          },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Documents fetched successfully',
        data: {
          items
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.DOCUMENT_LIST_FAILED,
          payload: req.params,
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Get all versions for a document
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - A promise that resolves to void
   */

  public getDocumentVersions = async (
    req: AuthenticatedRequest<{ documentId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.DOCUMENT_VERSION_LIST_INIT,
        payload: req.params,
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const document = await documentRepository.findByPk(req.params.documentId);

      if (!document) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'Document not found'
        });
        return;
      }

      await getReadableApplication(req, document.application_id);

      const versions = await documentVersionRepository.findAll({
        where: { document_id: document.id },
        order: [['version_number', 'DESC']]
      });

      logger.info(
        log({
          event: LoggerEvents.DOCUMENT_VERSION_LIST_SUCCESS,
          data: {
            documentId: document.id,
            count: versions.length
          },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Document versions fetched successfully',
        data: {
          document: {
            id: document.id,
            application_id: document.application_id,
            document_type: document.document_type
          },
          items: versions.map(sanitizeDocumentVersion)
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.DOCUMENT_VERSION_LIST_FAILED,
          payload: req.params,
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Download a document version
   * @param req - The request object
   * @param res - The response object
   * @param next - The next function
   * @returns - A promise that resolves to void
   */

  public downloadDocumentVersion = async (
    req: AuthenticatedRequest<{ versionId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.DOCUMENT_DOWNLOAD_INIT,
        payload: req.params,
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const version = await documentVersionRepository.findByPk(
        req.params.versionId
      );

      if (!version) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'Document version not found'
        });
        return;
      }

      const document = await documentRepository.findByPk(version.document_id);

      if (!document) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'Document not found'
        });
        return;
      }

      await getReadableApplication(req, document.application_id);

      const absolutePath = this.storageService.getAbsolutePath(
        version.stored_filename
      );
      await fs.access(absolutePath);
      const fileStats = await fs.stat(absolutePath);
      if (!fileStats.size) {
        responseWrapper({
          res,
          status: httpCodes.UNPROCESSABLE_ENTITY,
          message:
            'Stored document file is empty. Please re-upload the document.'
        });
        return;
      }

      logger.info(
        log({
          event: LoggerEvents.DOCUMENT_DOWNLOAD_SUCCESS,
          data: {
            versionId: version.id,
            documentId: document.id
          },
          user: req.user,
          requestId: req.requestId
        })
      );

      res.download(absolutePath, version.original_filename);
      return;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'Stored document file not found'
        });
        return;
      }

      logger.error(
        log({
          event: LoggerEvents.DOCUMENT_DOWNLOAD_FAILED,
          payload: req.params,
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };

}

export default DocumentsRepository;
