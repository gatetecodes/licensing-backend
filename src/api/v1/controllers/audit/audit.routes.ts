import express from 'express';
import AuditController from './audit.controller';
import { isAuth } from '../../middlewares/auth.middleware';
import * as validate from './audit.validation';

/**
 * @openapi
 * tags:
 *   - name: Audit
 *     description: Immutable audit history for applications
 *
 * /applications/{id}/audit-log:
 *   get:
 *     tags: [Audit]
 *     summary: Get audit log timeline for an application
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
 *         description: Audit log fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuditLogListResponseData'
 *       404:
 *         description: Application not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export class AuditRoutes extends AuditController {
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

    this._router.get(
      '/applications/:id/audit-log',
      validate.validateApplicationAuditPath,
      this.getApplicationAuditLog
    );
  };
}

export default AuditRoutes;
