const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend }
  }))
}));

jest.mock('../src/helpers/logger-helper', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('config', () => ({
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      'app.emailSender.authKey': 'seed-auth-key',
      'app.emailSender.senderName': 'BNR',
      'app.emailSender.senderEmail': 'no-reply@bnr.rw'
    };
    return values[key];
  })
}));

import fs from 'node:fs';
import { sendEmail } from '../src/services/email.service';
import { logger } from '../src/helpers/logger-helper';

describe('email.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends an email with compiled template and embedded brand logo', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
      const value = String(targetPath);
      return (
        value.endsWith('/dist/assets/email/bnr-logo.webp') ||
        value.endsWith('/dist/templates/application-submitted-reviewer.hbs')
      );
    });

    jest
      .spyOn(fs.promises, 'readFile')
      .mockImplementation(async (targetPath, options) => {
        const value = String(targetPath);
        if (value.endsWith('/bnr-logo.webp')) {
          return Buffer.from('logo');
        }

        if (
          value.endsWith('/application-submitted-reviewer.hbs') &&
          options === 'utf-8'
        ) {
          return '<html>{{logoCid}} {{institutionName}}</html>';
        }

        throw new Error('Unexpected read target');
      });

    mockSend.mockResolvedValue({ id: 'email-1' });

    const result = await sendEmail({
      to: 'reviewer@example.com',
      subject: 'Hello',
      template: 'application-submitted-reviewer',
      context: { institutionName: 'Acme Bank' }
    });

    expect(result).toEqual({ success: true });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'BNR <no-reply@bnr.rw>',
        to: ['reviewer@example.com'],
        html: '<html>cid:bnr-logo Acme Bank</html>',
        attachments: [
          expect.objectContaining({
            filename: 'bnr-logo.webp',
            contentId: 'bnr-logo'
          })
        ]
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Email sent',
      expect.objectContaining({ event: 'EMAIL_SENT' })
    );
  });

  it('throws when resend returns an API error', async () => {
    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((targetPath) =>
        String(targetPath).endsWith(
          '/dist/templates/application-submitted-reviewer.hbs'
        )
      );
    jest
      .spyOn(fs.promises, 'readFile')
      .mockResolvedValue('<html>{{institutionName}}</html>');
    mockSend.mockResolvedValue({
      error: { message: 'quota exceeded' }
    });

    await expect(
      sendEmail({
        to: ['reviewer@example.com'],
        subject: 'Hello',
        template: 'application-submitted-reviewer',
        context: { institutionName: 'Acme Bank' }
      })
    ).rejects.toThrow('Failed to send email with Resend');

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to send email with Resend',
      expect.any(Object)
    );
  });

  it('throws when template cannot be resolved', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(
      sendEmail({
        to: 'reviewer@example.com',
        subject: 'Hello',
        template: 'missing-template',
        context: {}
      })
    ).rejects.toThrow('Failed to send email with Resend');

    expect(logger.error).toHaveBeenCalled();
  });
});
