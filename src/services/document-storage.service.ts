import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import config from 'config';

import { SavedDocumentFile } from '../types/document.types';

export class DocumentStorageService {
  private readonly storageDir: string;

  constructor() {
    const configuredDir = config.has('app.documents.storageDir')
      ? (config.get('app.documents.storageDir') as string)
      : 'storage/documents';

    this.storageDir = path.resolve(process.cwd(), configuredDir);
  }

  /**
   * @description Get the storage directory
   * @returns - The storage directory
   */

  public readonly getStorageDir = (): string => this.storageDir;

  /**
   * @description Get the absolute path of a stored filename
   * @param storedFilename - The stored filename
   * @returns - The absolute path
   */

  public readonly getAbsolutePath = (storedFilename: string): string =>
    path.join(this.storageDir, storedFilename);

  /**
   * @description Save a file to the storage directory
   * @param fileBuffer - The file buffer
   * @param originalFilename - The original filename
   * @returns - The saved document file
   */

  public readonly saveFile = async (
    fileBuffer: Buffer,
    originalFilename: string
  ): Promise<SavedDocumentFile> => {
    const normalizedBuffer = Buffer.isBuffer(fileBuffer)
      ? fileBuffer
      : Buffer.from(fileBuffer);

    if (normalizedBuffer.length === 0) {
      throw new Error('Uploaded file content is empty');
    }

    await fs.mkdir(this.storageDir, { recursive: true });

    const checksum = crypto
      .createHash('sha256')
      .update(normalizedBuffer)
      .digest('hex');
    const extension = path.extname(originalFilename);
    const storedFilename = `${crypto.randomUUID()}${extension.toLowerCase()}`;
    const absolutePath = this.getAbsolutePath(storedFilename);

    await fs.writeFile(absolutePath, normalizedBuffer);
    const writtenFileStats = await fs.stat(absolutePath);
    if (!writtenFileStats.size) {
      throw new Error('Stored document file is empty');
    }

    return {
      storedFilename,
      checksum,
      absolutePath
    };
  };

  /**
   * @description Remove a file from the storage directory
   * @param storedFilename - The stored filename
   * @returns - A promise that resolves to void
   */

  public readonly removeFile = async (
    storedFilename: string
  ): Promise<void> => {
    const absolutePath = this.getAbsolutePath(storedFilename);

    await fs.rm(absolutePath, { force: true });
  };
}

export default DocumentStorageService;
