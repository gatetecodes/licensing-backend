import express from 'express';
import DocumentsController from './documents.controller';
import { isAuth, requireRoles } from '../../middlewares/auth.middleware';
import { Roles } from '../../../../types/role.types';
import * as validate from './documents.validation';

/**
 * @openapi
 * tags:
 *   - name: Documents
 *     description: Application document upload, versioning, and download
 *
 * /applications/{id}/documents:
 *   post:
 *     tags: [Documents]
 *     summary: Upload a document for an application
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, document_type]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               document_type:
 *                 type: string
 *                 enum: [BUSINESS_PLAN, CERTIFICATE_OF_INCORPORATION, SHAREHOLDING_STRUCTURE, CAPITAL_ADEQUACY_EVIDENCE, GOVERNANCE_DOCUMENT]
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DocumentResponseData'
 *       413:
 *         description: Document exceeds maximum size
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   get:
 *     tags: [Documents]
 *     summary: List documents for an application
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Documents fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DocumentListResponseData'
 *       404:
 *         description: Application not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /documents/{documentId}/versions:
 *   get:
 *     tags: [Documents]
 *     summary: List versions for a document
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Document versions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DocumentVersionListResponseData'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /document-versions/{versionId}/download:
 *   get:
 *     tags: [Documents]
 *     summary: Download a specific document version
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Document file download response
  *       404:
  *         description: Document version or file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export class DocumentsRoutes extends DocumentsController {
  private _router = express.Router();

  constructor() {
    super();
    this.createRoutes();
  }

  public get router() {
    return this._router;
  }

  private createRoutes = () => {
    this._router.use(isAuth);

    this._router.post(
      '/applications/:id/documents',
      requireRoles(Roles.APPLICANT),
      validate.handleDocumentUpload,
      validate.validateUploadDocument,
      this.uploadDocument
    );

    this._router.get(
      '/applications/:id/documents',
      validate.validateApplicationDocumentsPath,
      this.getApplicationDocuments
    );

    this._router.get(
      '/documents/:documentId/versions',
      validate.validateDocumentVersionsPath,
      this.getDocumentVersions
    );

    this._router.get(
      '/document-versions/:versionId/download',
      validate.validateDocumentVersionDownloadPath,
      this.downloadDocumentVersion
    );
  };
}

export default DocumentsRoutes;
