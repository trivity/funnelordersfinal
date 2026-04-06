export class AppError extends Error {
  constructor(
    public code: string,
    public override message: string,
    public statusCode: number = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
