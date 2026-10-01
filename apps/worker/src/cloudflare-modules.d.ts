// Minimal declarations for the Workers runtime modules this app imports.
// The full @cloudflare/workers-types globals clash with the DOM lib the
// web app shares this tsconfig with.
declare module 'cloudflare:workers' {
  type Duration = `${number} ${'second' | 'seconds' | 'minute' | 'minutes' | 'hour' | 'hours'}` | number;
  export type WorkflowStepConfig = {
    retries?: {
      limit: number;
      delay: Duration;
      backoff?: 'constant' | 'linear' | 'exponential';
    };
    timeout?: Duration;
  };
  export type WorkflowEvent<T> = {
    payload: Readonly<T>;
    timestamp: Date;
    instanceId: string;
  };
  export interface WorkflowStep {
    do<T>(name: string, callback: () => Promise<T>): Promise<T>;
    do<T>(
      name: string,
      config: WorkflowStepConfig,
      callback: () => Promise<T>,
    ): Promise<T>;
    sleep(name: string, duration: Duration): Promise<void>;
  }
  export abstract class WorkflowEntrypoint<Env = unknown, T = unknown> {
    protected env: Env;
    constructor(ctx: unknown, env: Env);
    run(event: WorkflowEvent<T>, step: WorkflowStep): Promise<unknown>;
  }
}
declare module 'cloudflare:workflows' {
  export class NonRetryableError extends Error {
    constructor(message: string, name?: string);
  }
}
