export abstract class CustomError extends Error {
  abstract statusCode: number;
  public abstract messageKey: string;
  protected params?: Record<string, any>;

  constructor(params?: Record<string, any>) {
    super('Error occurred'); // Temporary message

    this.params = params;

    Object.setPrototypeOf(this, CustomError.prototype);
  }

  // Method to be called after messageKey is set in child constructor
  protected setupMessage(): void {
    // Override the message property with a getter that returns localized message
    Object.defineProperty(this, 'message', {
      get: () => this.message,
      configurable: true,
      enumerable: true
    });
  }

  serializeErrors(): { message: string; field?: string }[] {
    return [{ message: this.message }];
  }
}
