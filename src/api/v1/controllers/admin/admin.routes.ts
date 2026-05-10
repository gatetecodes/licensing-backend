import express from 'express';
import AdminController from './admin.controller';
import { isAuth, requireRoles } from '../../middlewares/auth.middleware';
import { Roles } from '../../../../types/role.types';
import * as validate from './admin.validation';

/**
 * @openapi
 * tags:
 *   - name: Administration
 *     description: Internal admin user management
 *
 * /admin/users:
 *   get:
 *     tags: [Administration]
 *     summary: List internal users managed by admins
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [REVIEWER, APPROVER, ADMIN, SUPER_ADMIN]
 *     responses:
 *       200:
 *         description: Admin users fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminUserListResponseData'
 *
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Administration]
 *     summary: Update internal user status
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
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DISABLED]
 *     responses:
 *       200:
 *         description: User status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminUserResponseData'
 */
export class AdminRoutes extends AdminController {
  private _router = express.Router();

  constructor() {
    super();
    this.createRoutes();
  }

  public get router() {
    return this._router;
  }

  private createRoutes = () => {
    this._router.use(isAuth, requireRoles(Roles.ADMIN, Roles.SUPER_ADMIN));

    this._router.get(
      '/users',
      validate.validateListInternalUsers,
      this.getInternalUsers
    );

    this._router.patch(
      '/users/:id/status',
      validate.validateUpdateInternalUserStatus,
      this.updateInternalUserStatus
    );
  };
}

export default AdminRoutes;
