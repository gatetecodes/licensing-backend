import express from 'express';
import WorkflowController from './workflow.controller';
import { isAuth, requireRoles } from '../../middlewares/auth.middleware';
import { Roles } from '../../../../types/role.types';
import * as validate from './workflow.validation';

/**
 * @openapi
 * tags:
 *   - name: Workflow
 *     description: Reviewer and approver workflow transitions
 *
 * /applications/{id}/start-review:
 *   post:
 *     tags: [Workflow]
 *     summary: Start review cycle
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
 *         description: Review started successfully
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
 *       409:
 *         description: Application state conflict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /applications/{id}/request-information:
 *   post:
 *     tags: [Workflow]
 *     summary: Request additional information from applicant
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
 *             required: [lock_version, request_items]
 *             properties:
 *               lock_version:
 *                 type: integer
 *                 minimum: 0
 *               reviewer_summary_note:
 *                 type: string
 *               request_items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [type, instruction]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [FIELD_UPDATE, DOCUMENT_REPLACEMENT, ADDITIONAL_DOCUMENT, OPEN_QUESTION]
 *                     instruction:
 *                       type: string
 *                     field_key:
 *                       type: string
 *                     document_type:
 *                       type: string
 *                     required:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Information requested successfully
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
 * /applications/{id}/mark-ready-for-decision:
 *   post:
 *     tags: [Workflow]
 *     summary: Mark application ready for final decision
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
 *             required: [lock_version, notes]
 *             properties:
 *               lock_version:
 *                 type: integer
 *                 minimum: 0
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application marked ready for decision successfully
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
 * /applications/{id}/approve:
 *   post:
 *     tags: [Workflow]
 *     summary: Approve application
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
 *             required: [lock_version, decision_reason]
 *             properties:
 *               lock_version:
 *                 type: integer
 *                 minimum: 0
 *               decision_reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application approved successfully
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
 *       409:
 *         description: Application state conflict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /applications/{id}/reject:
 *   post:
 *     tags: [Workflow]
 *     summary: Reject application
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
 *             required: [lock_version, decision_reason]
 *             properties:
 *               lock_version:
 *                 type: integer
 *                 minimum: 0
 *               decision_reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application rejected successfully
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
 *       409:
 *         description: Application state conflict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export class WorkflowRoutes extends WorkflowController {
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
      '/:id/start-review',
      requireRoles(Roles.REVIEWER),
      validate.validateWorkflowAction,
      this.startReview
    );

    this._router.post(
      '/:id/request-information',
      requireRoles(Roles.REVIEWER),
      validate.validateWorkflowInformationRequest,
      this.requestInformation
    );

    this._router.post(
      '/:id/mark-ready-for-decision',
      requireRoles(Roles.REVIEWER),
      validate.validateWorkflowNotes,
      this.markReadyForDecision
    );

    this._router.post(
      '/:id/approve',
      requireRoles(Roles.APPROVER),
      validate.validateWorkflowDecision,
      this.approve
    );

    this._router.post(
      '/:id/reject',
      requireRoles(Roles.APPROVER),
      validate.validateWorkflowDecision,
      this.reject
    );
  };
}

export default WorkflowRoutes;
