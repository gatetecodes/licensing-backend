import httpCodes from '../constants/http-codes';
import { Router } from 'express';
import express, { Request, Response } from 'express';
import ApplicationsRoutes from '../api/v1/controllers/applications/applications.routes';
import AuditRoutes from '../api/v1/controllers/audit/audit.routes';
import DocumentsRoutes from '../api/v1/controllers/documents/documents.routes';
import WorkflowRoutes from '../api/v1/controllers/workflow/workflow.routes';
import AdminRoutes from '../api/v1/controllers/admin/admin.routes';

export class MainRoutes {
  private _router = express.Router();
  private applicationsRoutes = new ApplicationsRoutes().router;
  private auditRoutes = new AuditRoutes().router;
  private documentsRoutes = new DocumentsRoutes().router;
  private workflowRoutes = new WorkflowRoutes().router;
  private adminRoutes = new AdminRoutes().router;
  constructor() {
    this.routes();
  }

  public get router(): Router {
    return this._router;
  }
  private routes(): void {
    this._router.get('/health', async (_req: Request, res: Response) => {
      res.send(httpCodes.OK);
    });

    this._router.use('/applications', this.applicationsRoutes);
    this._router.use('/applications', this.workflowRoutes);
    this._router.use('/', this.documentsRoutes);
    this._router.use('/', this.auditRoutes);
    this._router.use('/admin', this.adminRoutes);
  }
}
