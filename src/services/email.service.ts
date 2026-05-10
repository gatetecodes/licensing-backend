import fs from 'node:fs';
import path from 'node:path';
import handlebars from 'handlebars';
import { Resend } from 'resend';
import { logger } from '../helpers/logger-helper';
import config from 'config';

if (!config.get('app.emailSender.authKey')) {
  throw new Error('RESEND_API_KEY is not set');
}

const resend = new Resend(config.get('app.emailSender.authKey'));

type ResendEmailOptions = {
  to: string | string[];
  subject: string;
  template: string;
  context: Record<string, unknown>;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentId?: string;
  }>;
  tags?: Array<{
    name: string;
    value: string;
  }>;
};

const BRAND_LOGO_FILENAME = 'bnr-logo.webp';
const BRAND_LOGO_CONTENT_ID = 'bnr-logo';

const resolveBrandLogoAttachment = async (): Promise<
  | {
      attachment: {
        filename: string;
        content: Buffer;
        contentId: string;
      };
      logoCid: string;
    }
  | undefined
> => {
  const dirs = [
    path.resolve(process.cwd(), 'dist/assets/email'),
    path.resolve(process.cwd(), 'src/assets/email')
  ];

  for (const dir of dirs) {
    const fp = path.join(dir, BRAND_LOGO_FILENAME);
    if (fs.existsSync(fp)) {
      const content = await fs.promises.readFile(fp);
      return {
        attachment: {
          filename: BRAND_LOGO_FILENAME,
          content,
          contentId: BRAND_LOGO_CONTENT_ID
        },
        logoCid: `cid:${BRAND_LOGO_CONTENT_ID}`
      };
    }
  }

  return undefined;
};

/**
 * Compile Handlebars template
 */
const compileTemplate = async (
  templateName: string,
  context: Record<string, unknown>
): Promise<string> => {
  try {
    const candidates = [
      path.resolve(process.cwd(), 'dist/templates'),
      path.resolve(process.cwd(), 'src/templates')
    ].filter(Boolean) as string[];

    for (const dir of candidates) {
      const fp = path.join(dir, `${templateName}.hbs`);

      if (fs.existsSync(fp)) {
        const source = await fs.promises.readFile(fp, 'utf-8');

        const template = handlebars.compile(source);

        return template(context);
      }
    }

    throw new Error('Template not found in any known directory');
  } catch (error) {
    logger.error('Failed to compile email template', {
      error,
      data: { templateName, context }
    });

    throw new Error('Failed to compile email template');
  }
};

/**
 * Send email using Resend API with enhanced features
 */
export const sendEmail = async ({
  to,
  subject,
  template,
  context,
  cc,
  bcc,
  attachments,
  tags
}: ResendEmailOptions): Promise<{ success: boolean }> => {
  try {
    const brandLogo = await resolveBrandLogoAttachment();
    const html = await compileTemplate(template, {
      ...context,
      logoCid: brandLogo?.logoCid ?? ''
    });

    if (
      !(
        config.get('app.emailSender.senderName') &&
        config.get('app.emailSender.senderEmail')
      )
    ) {
      throw new Error('EMAIL_FROM_NAME/EMAIL_FROM_ADDRESS not set');
    }

    const mergedAttachments = [
      ...(brandLogo ? [brandLogo.attachment] : []),
      ...(attachments ?? [])
    ];

    const emailData = {
      from: `${config.get('app.emailSender.senderName')} <${config.get('app.emailSender.senderEmail')}>`,
      to: Array.isArray(to) ? to : [to],
      cc,
      bcc,
      subject,
      html,
      ...(mergedAttachments.length > 0 ? { attachments: mergedAttachments } : {}),
      tags
    };

    const result = await resend.emails.send(emailData);

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }

    logger.info('Email sent', {
      event: 'EMAIL_SENT',
      data: { to, subject, template }
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to send email with Resend', {
      error,
      data: { to, subject, template }
    });
    throw new Error('Failed to send email with Resend');
  }
};
