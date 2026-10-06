import { ModelInitializationError, ModelNotReadyError } from '../errors';

export class ModelManager<TModel> {
  private model: TModel | null = null;
  private pending: Promise<void> | null = null;

  constructor(private readonly loader: () => Promise<TModel>) {}

  async initialize(): Promise<void> {
    if (this.model) return;
    if (!this.pending) {
      this.pending = this.loader()
        .then((model) => {
          this.model = model;
        })
        .catch((error: unknown) => {
          this.pending = null;
          throw error;
        });
    }
    await this.pending;
  }

  getModel(): TModel {
    if (!this.model) throw new ModelNotReadyError();
    return this.model;
  }

  async dispose(): Promise<void> {
    const current = this.model;
    if (isDisposable(current)) current.dispose();
    this.model = null;
    this.pending = null;
  }
}

function isDisposable(value: unknown): value is { dispose: () => void } {
  return typeof value === 'object' && value !== null && 'dispose' in value && typeof value.dispose === 'function';
}

export function modelLoadFailure(error: unknown): ModelInitializationError {
  if (error instanceof ModelInitializationError) return error;
  const message = error instanceof Error ? error.message : 'Model initialization failed';
  return new ModelInitializationError(message, { cause: error });
}
