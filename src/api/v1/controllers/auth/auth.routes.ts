import express from 'express';
import { AuthController } from './auth.controller';
import { validateLogin } from './auth.validation';
import * as validate from './auth.validation';
import { isAuth, requireRoles } from '../../middlewares/auth.middleware';
import { Roles } from '../../../../types/role.types';

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication and account onboarding
 *
 * /auth/csrf-token:
 *   get:
 *     tags: [Auth]
 *     summary: Get CSRF token
 *     responses:
 *       200:
 *         description: CSRF token fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/CsrfTokenResponseData'
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthMeResponseData'
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get authenticated user
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Authenticated user fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthMeResponseData'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current session
 *     security:
 *       - sessionCookie: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Public applicant registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, institution_name]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               institution_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *
 * /auth/invite-internal-user:
 *   post:
 *     tags: [Auth]
 *     summary: Invite an internal user
 *     security:
 *       - sessionCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, role]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [REVIEWER, APPROVER, ADMIN]
 *     responses:
 *       200:
 *         description: Internal user invited successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/password-setup/request:
 *   post:
 *     tags: [Auth]
 *     summary: Request password setup token for invited user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password setup email sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *
 * /auth/set-password:
 *   post:
 *     tags: [Auth]
 *     summary: Set password with one-time token
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword, confirmPassword]
 *             properties:
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password set successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify applicant email with one-time token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthMeResponseData'
 */
export class AuthRoutes extends AuthController {
  private _router = express.Router();

  constructor() {
    super();
    this.createRoutes();
  }

  public get router() {
    return this._router;
  }

  private createRoutes = () => {
    this._router.get('/csrf-token', this.getCsrfToken);

    this._router.post('/login', validateLogin, this.login);

    this._router.get('/me', isAuth, this.getMe);

    this.router.post('/logout', isAuth, this.logout);

    this._router.post('/register', validate.validateRegister, this.register);

    this._router.post(
      '/invite-internal-user',
      isAuth,
      requireRoles(Roles.ADMIN),
      validate.validateInviteInternalUser,
      this.inviteInternalUser
    );

    this._router.post(
      '/password-setup/request',
      validate.validatePasswordSetupRequest,
      this.requestPasswordSetup
    );

    this._router.post(
      '/set-password',
      validate.validateSetPassword,
      this.setPassword
    );

    this._router.post(
      '/verify-email',
      validate.validateVerifyEmail,
      this.verifyEmail
    );
  };
}

export default AuthRoutes;
