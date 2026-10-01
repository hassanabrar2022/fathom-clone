import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
} from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import type { IngestionEnv } from './ingestion';
import {
  LeaseLost,
  analyzeMeeting,
  failProcessing,
  finishProcessing,
  planTranscription,
  storeUpload,
  transcribeChunk,
  transcribeWhole,
  type ProcessParams,
  type ProcessingFailure,
} from './processing';

const storage: WorkflowStepConfig = {
  retries: { limit: 4, delay: '5 seconds', backoff: 'exponential' },
  timeout: '2 minutes',
};
const model: WorkflowStepConfig = {
  retries: { limit: 3, delay: '15 seconds', backoff: 'exponential' },
  timeout: '5 minutes',
};

/** Durable meeting processing: survives tab closes, retries each step alone. */
export class ProcessMeetingWorkflow extends WorkflowEntrypoint<
  IngestionEnv,
  ProcessParams
> {
  async run(event: WorkflowEvent<ProcessParams>, step: WorkflowStep) {
    const p = event.payload;
    const env = this.env;
    const run = <T>(work: () => Promise<T>) =>
      work().catch((error: unknown) => {
        if (error instanceof LeaseLost) throw new NonRetryableError(error.message);
        throw error;
      });
    let failure: ProcessingFailure = 'upload_failed';
    try {
      await step.do('store upload', storage, () => run(() => storeUpload(env, p)));
      failure = 'transcription_failed';
      const plan = await step.do('plan transcription', storage, () =>
        run(() => planTranscription(env, p)),
      );
      if (plan.kind === 'whole')
        await step.do('transcribe', model, () => run(() => transcribeWhole(env, p)));
      if (plan.kind === 'chunks')
        for (let index = plan.next; index < plan.chunks; index++)
          await step.do(`transcribe part ${index + 1}`, model, () =>
            run(() =>
              transcribeChunk(env, p, index, plan.audioSize, plan.chunks),
            ),
          );
      failure = 'analysis_failed';
      await step.do('analyze', model, () => run(() => analyzeMeeting(env, p)));
      await step.do('finish', storage, () => run(() => finishProcessing(env, p)));
    } catch (error) {
      console.error('Meeting processing failed', {
        meetingId: p.meetingId,
        failure,
        error: error instanceof Error ? error.message : String(error),
      });
      await step.do('record failure', storage, () =>
        failProcessing(env, p, failure),
      );
    }
  }
}
