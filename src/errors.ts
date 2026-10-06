export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class InvalidRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, 'invalid_request');
  }
}

export class InvalidImageError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 400, 'invalid_image', options);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string) {
    super(message, 413, 'payload_too_large');
  }
}

export class ImageTooLargeError extends AppError {
  constructor(message: string) {
    super(message, 413, 'image_too_large');
  }
}

export class PreprocessingError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 400, 'preprocessing_failed', options);
  }
}

export class ModelInitializationError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 503, 'model_initialization_failed', options);
  }
}

export class ModelNotReadyError extends AppError {
  constructor() {
    super('The classification model is not loaded', 503, 'model_not_ready');
  }
}

export class ClassificationError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 500, 'classification_failed', options);
  }
}

export class EvaluationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'invalid_evaluation');
  }
}
