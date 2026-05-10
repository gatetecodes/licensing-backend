import 'dotenv/config';
import swaggerJSDoc, { SwaggerDefinition } from 'swagger-jsdoc';
import path from 'path';
import swaggerUI from 'swagger-ui-express';
import config from 'config';

const apiUrl =  (config.get('app.apiUrl') as string)
 

const definition: SwaggerDefinition = {
  info: {
    title: 'BNR Licensing Portal API',
    version: '1.0.0',
    description: 'API documentation for BNR Licensing Portal'
  },
  servers: [{ url: `${apiUrl}/api/v1` }],
  openapi: '3.0.0',
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'bnr.sid'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'integer', example: 403 },
          message: { type: 'string', example: 'FORBIDDEN' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                field: { type: 'string' },
                type: { type: 'string' },
                value: {}
              }
            }
          },
          timestamp: { type: 'string', example: '2026-05-09 03:27:59 PM' }
        }
      },
      SuccessEnvelope: {
        type: 'object',
        properties: {
          status: { type: 'integer', example: 200 },
          message: { type: 'string', example: 'Request successful' },
          data: { type: 'object' },
          timestamp: { type: 'string', example: '2026-05-09 03:27:59 PM' }
        }
      },
      Role: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: {
            type: 'string',
            enum: ['APPLICANT', 'REVIEWER', 'APPROVER', 'ADMIN', 'SUPER_ADMIN']
          }
        }
      },
      UserSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: {
            oneOf: [{ $ref: '#/components/schemas/Role' }, { type: 'null' }]
          }
        }
      },
      UserStatus: {
        type: 'string',
        enum: [
          'PENDING_EMAIL_VERIFICATION',
          'PENDING_PASSWORD_SETUP',
          'ACTIVE',
          'DISABLED'
        ]
      },
      AdminUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          institution_name: { type: 'string' },
          status: { $ref: '#/components/schemas/UserStatus' },
          email_verified_at: {
            type: 'string',
            format: 'date-time',
            nullable: true
          },
          roles: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['REVIEWER', 'APPROVER', 'ADMIN', 'SUPER_ADMIN']
            }
          },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      AdminUserResponseData: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/AdminUser' }
        }
      },
      AdminUserListResponseData: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/AdminUser' }
          }
        }
      },
      CsrfTokenResponseData: {
        type: 'object',
        properties: {
          csrfToken: { type: 'string' }
        }
      },
      AuthMeResponseData: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/UserSummary' },
          csrfToken: { type: 'string' }
        }
      },
      InstitutionType: {
        type: 'string',
        enum: ['BANK', 'MICROFINANCE', 'INSURANCE', 'LEASING', 'OTHER']
      },
      ApplicationState: {
        type: 'string',
        enum: [
          'DRAFT',
          'SUBMITTED',
          'UNDER_REVIEW',
          'INFO_REQUESTED',
          'RESUBMITTED',
          'READY_FOR_DECISION',
          'APPROVED',
          'REJECTED'
        ]
      },
      Application: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          reference_number: { type: 'string' },
          applicant_id: { type: 'string', format: 'uuid' },
          institution_name: { type: 'string' },
          institution_type: { $ref: '#/components/schemas/InstitutionType' },
          business_address: { type: 'string', nullable: true },
          contact_name: { type: 'string', nullable: true },
          contact_email: { type: 'string', nullable: true },
          contact_phone: { type: 'string', nullable: true },
          license_category: {
            type: 'string',
            nullable: true,
            enum: [
              'COMMERCIAL_BANK',
              'MICROFINANCE_DEPOSIT_TAKING',
              'MICROFINANCE_NON_DEPOSIT_TAKING',
              'INSURANCE_LIFE',
              'INSURANCE_NON_LIFE',
              'PAYMENT_SERVICE_PROVIDER',
              'LEASING_LICENSE',
              'OTHER'
            ]
          },
          license_category_other_details: { type: 'string', nullable: true },
          capital_amount_rwf: { type: 'number', nullable: true },
          incorporation_date: { type: 'string', format: 'date', nullable: true },
          business_summary: { type: 'string', nullable: true },
          current_state: { $ref: '#/components/schemas/ApplicationState' },
          submitted_at: { type: 'string', format: 'date-time', nullable: true },
          reviewed_by_id: { type: 'string', format: 'uuid', nullable: true },
          decisioned_by_id: { type: 'string', format: 'uuid', nullable: true },
          decision_at: { type: 'string', format: 'date-time', nullable: true },
          decision_reason: { type: 'string', nullable: true },
          latest_info_request: {
            oneOf: [
              { $ref: '#/components/schemas/LatestInfoRequest' },
              { type: 'null' }
            ]
          },
          lock_version: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      WorkflowRequestItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'FIELD_UPDATE',
              'DOCUMENT_REPLACEMENT',
              'ADDITIONAL_DOCUMENT',
              'OPEN_QUESTION'
            ]
          },
          instruction: { type: 'string' },
          field_key: { type: 'string', nullable: true },
          document_type: {
            $ref: '#/components/schemas/DocumentType'
          },
          required: { type: 'boolean' }
        }
      },
      WorkflowResponseItem: {
        type: 'object',
        properties: {
          request_item_id: { type: 'string' },
          answer_text: { type: 'string', nullable: true }
        }
      },
      LatestInfoRequest: {
        type: 'object',
        properties: {
          reviewer_summary_note: { type: 'string', nullable: true },
          requested_at: { type: 'string', format: 'date-time' },
          request_items: {
            type: 'array',
            items: { $ref: '#/components/schemas/WorkflowRequestItem' }
          },
          applicant_responses: {
            oneOf: [
              {
                type: 'array',
                items: { $ref: '#/components/schemas/WorkflowResponseItem' }
              },
              { type: 'null' }
            ]
          },
          responded_at: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      ApplicationResponseData: {
        type: 'object',
        properties: {
          application: { $ref: '#/components/schemas/Application' }
        }
      },
      ApplicationListResponseData: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/Application' }
          },
          count: {
            type: 'integer',
            example: 2
          }
        }
      },
      DocumentType: {
        type: 'string',
        enum: [
          'BUSINESS_PLAN',
          'CERTIFICATE_OF_INCORPORATION',
          'SHAREHOLDING_STRUCTURE',
          'CAPITAL_ADEQUACY_EVIDENCE',
          'GOVERNANCE_DOCUMENT',
          'SUPPORTING_DOCUMENT'
        ]
      },
      DocumentVersion: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          document_id: { type: 'string', format: 'uuid' },
          version_number: { type: 'integer' },
          stored_filename: { type: 'string' },
          original_filename: { type: 'string' },
          mime_type: { type: 'string' },
          file_size_bytes: { type: 'integer' },
          checksum: { type: 'string' },
          uploaded_by_id: { type: 'string', format: 'uuid' },
          uploaded_at: { type: 'string', format: 'date-time' },
          supersedes_version_id: {
            type: 'string',
            format: 'uuid',
            nullable: true
          }
        }
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          application_id: { type: 'string', format: 'uuid' },
          document_type: { $ref: '#/components/schemas/DocumentType' },
          created_at: { type: 'string', format: 'date-time' },
          latest_version: {
            oneOf: [
              { $ref: '#/components/schemas/DocumentVersion' },
              { type: 'null' }
            ]
          },
          versions_count: { type: 'integer' }
        }
      },
      DocumentResponseData: {
        type: 'object',
        properties: {
          document: { $ref: '#/components/schemas/Document' }
        }
      },
      DocumentListResponseData: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/Document' }
          }
        }
      },
      DocumentVersionListResponseData: {
        type: 'object',
        properties: {
          document: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              application_id: { type: 'string', format: 'uuid' },
              document_type: { $ref: '#/components/schemas/DocumentType' }
            }
          },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/DocumentVersion' }
          }
        }
      },
      AuditLogEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          application_id: { type: 'string', format: 'uuid' },
          acting_user_id: { type: 'string', format: 'uuid' },
          action_type: { type: 'string' },
          occurred_at: { type: 'string', format: 'date-time' },
          before_state: { type: 'string', nullable: true },
          after_state: { type: 'string', nullable: true },
          request_id: { type: 'string' },
          ip_address: { type: 'string', nullable: true },
          user_agent: { type: 'string', nullable: true },
          metadata: { type: 'object' },
          previous_hash: { type: 'string', nullable: true },
          entry_hash: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      AuditLogListResponseData: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/AuditLogEntry' }
          }
        }
      }
    }
  }
};

const options = {
  swaggerDefinition: definition,
  apis: [
    path.join(__dirname, '../../api/v1/controllers/**/*.ts'),
    path.join(__dirname, './*.yaml'),
    path.join(__dirname, './*.yml')
  ]
};

export const swaggerSpec = swaggerJSDoc(options);

const swaggerSetup = swaggerUI.setup(swaggerSpec);

export default swaggerSetup;
