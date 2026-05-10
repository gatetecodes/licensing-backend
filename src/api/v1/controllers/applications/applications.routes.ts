import express from 'express';
import ApplicationsController from './applications.controller';
import { isAuth, requireRoles } from '../../middlewares/auth.middleware';
import { Roles } from '../../../../types/role.types';
import * as validate from './applications.validation';

/**
 * @openapi
 * tags:
 *   - name: Applications
 *     description: Applicant-facing application draft and submission endpoints
 *
 * /applications:
 *   post:
 *     tags: [Applications]
 *     summary: Create a new application draft
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institution_name, institution_type]
 *             properties:
 *               institution_name:
 *                 type: string
 *               institution_type:
 *                 type: string
 *                 enum: [BANK, MICROFINANCE, INSURANCE, LEASING, OTHER]
 *               license_category:
 *                 type: string
 *                 enum: [COMMERCIAL_BANK, MICROFINANCE_DEPOSIT_TAKING, MICROFINANCE_NON_DEPOSIT_TAKING, INSURANCE_LIFE, INSURANCE_NON_LIFE, PAYMENT_SERVICE_PROVIDER, LEASING_LICENSE, OTHER]
 *               license_category_other_details:
 *                 type: string
 *               business_address:
 *                 type: string
 *               contact_name:
 *                 type: string
 *               contact_email:
 *                 type: string
 *               contact_phone:
 *                 type: string
 *               incorporation_date:
 *                 type: string
 *                 format: date
 *               capital_amount_rwf:
 *                 type: number
 *               business_summary:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application draft created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ApplicationResponseData'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   get:
 *     tags: [Applications]
 *     summary: List applications visible to current user
 *     security:
 *       - sessionCookie: []
 *     parameters:
 *       - in: query
 *         name: current_state
 *         schema:
 *           type: string
 *           enum: [DRAFT, SUBMITTED, UNDER_REVIEW, INFO_REQUESTED, RESUBMITTED, READY_FOR_DECISION, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Applications fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ApplicationListResponseData'
 *
 * /applications/{id}:
 *   get:
 *     tags: [Applications]
 *     summary: Get application details by id
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
 *         description: Application fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ApplicationResponseData'
 *       404:
 *         description: Application not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /applications/{id}/draft:
 *   patch:
 *     tags: [Applications]
 *     summary: Update own application draft
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
 *             required: [institution_name, institution_type, lock_version]
 *             properties:
 *               institution_name:
 *                 type: string
 *               institution_type:
 *                 type: string
 *                 enum: [BANK, MICROFINANCE, INSURANCE, LEASING, OTHER]
 *               license_category:
 *                 type: string
 *                 enum: [COMMERCIAL_BANK, MICROFINANCE_DEPOSIT_TAKING, MICROFINANCE_NON_DEPOSIT_TAKING, INSURANCE_LIFE, INSURANCE_NON_LIFE, PAYMENT_SERVICE_PROVIDER, LEASING_LICENSE, OTHER]
 *               license_category_other_details:
 *                 type: string
 *               business_address:
 *                 type: string
 *               contact_name:
 *                 type: string
 *               contact_email:
 *                 type: string
 *               contact_phone:
 *                 type: string
 *               incorporation_date:
 *                 type: string
 *                 format: date
 *               capital_amount_rwf:
 *                 type: number
 *               business_summary:
 *                 type: string
 *               lock_version:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Application draft updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ApplicationResponseData'
 *       409:
 *         description: Application state conflict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /applications/{id}/submit:
 *   post:
 *     tags: [Applications]
 *     summary: Submit application from draft
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
 *             required: [lock_version, responses]
 *             properties:
 *               lock_version:
 *                 type: integer
 *                 minimum: 0
 *               responses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [request_item_id]
 *                   properties:
 *                     request_item_id:
 *                       type: string
 *                     answer_text:
 *                       type: string
 *     responses:
 *       200:
 *         description: Application submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ApplicationResponseData'
 *       409:
 *         description: Application state conflict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /applications/{id}/resubmit:
 *   post:
 *     tags: [Applications]
 *     summary: Resubmit application after info request
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
 *             required: [lock_version]
 *             properties:
 *               lock_version:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Application resubmitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ApplicationResponseData'
 *       409:
 *         description: Application state conflict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export class ApplicationsRoutes extends ApplicationsController {
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
      '/',
      requireRoles(Roles.APPLICANT),
      validate.validateCreateApplication,
      this.createApplication
    );

    this._router.get(
      '/',
      validate.validateListApplications,
      this.getApplications
    );

    this._router.get(
      '/:id',
      validate.validateApplicationId,
      this.getApplication
    );

    this._router.patch(
      '/:id/draft',
      requireRoles(Roles.APPLICANT),
      validate.validateUpdateDraft,
      this.updateApplicationDraft
    );

    this._router.post(
      '/:id/submit',
      requireRoles(Roles.APPLICANT),
      validate.validateWorkflowAction,
      this.submitApplication
    );

    this._router.post(
      '/:id/resubmit',
      requireRoles(Roles.APPLICANT),
      validate.validateWorkflowResubmit,
      this.resubmitApplication
    );
  };
}

export default ApplicationsRoutes;
