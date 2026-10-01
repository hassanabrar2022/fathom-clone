import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
} from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import type { IngestionEnv } from './ingestion';
import {
  beginAnalysis,
  checkNotetaker,
  failCapture,
  importHighlights,
  importRecording,
  importTranscript,
  type CaptureCheck,
  type CaptureParams,
} from './capture';
import {
  LeaseLost,
  analyzeMeeting,
  failProcessing,
  finishProcessing,
  planTranscription,
  storeUpload,
  transcribeChunk,
  transcribePart,
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
      if (plan.kind === 'parts')
        for (let index = plan.next; index < plan.parts; index++)
          await step.do(`transcribe part ${index + 1}`, model, () =>
            run(() => transcribePart(env, p, index)),
          );
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

const poll: WorkflowStepConfig = {
  retries: { limit: 5, delay: '10 seconds', backoff: 'exponential' },
  timeout: '1 minute',
};
const download: WorkflowStepConfig = {
  retries: { limit: 5, delay: '30 seconds', backoff: 'exponential' },
  timeout: '30 minutes',
};
// Recall can finish the transcript a few minutes after the call.
const transcript: WorkflowStepConfig = {
  retries: { limit: 10, delay: '20 seconds', backoff: 'linear' },
  timeout: '5 minutes',
};
// About four hours of calls at the slowest polling rate.
const MAX_CHECKS = 450;

/** Follows a notetaker bot from scheduled to imported, then hands over to processing. */
export class CaptureMeetingWorkflow extends WorkflowEntrypoint<
  IngestionEnv,
  CaptureParams
> {
  async run(event: WorkflowEvent<CaptureParams>, step: WorkflowStep) {
    const p = event.payload;
    const env = this.env;
    try {
      let state: CaptureCheck = await step.do('check 0', poll, () =>
        checkNotetaker(env, p),
      );
      if (state.next === 'sleep') {
        await step.sleepUntil('wait for the meeting', new Date(state.until));
        state = await step.do('check after waiting', poll, () =>
          checkNotetaker(env, p),
        );
      }
      for (let index = 1; index <= MAX_CHECKS && state.next === 'wait'; index++) {
        await step.sleep(`pause ${index}`, `${state.delay} seconds`);
        state = await step.do(`check ${index}`, poll, () => checkNotetaker(env, p));
      }
      if (state.next === 'wait')
        throw new Error('The call ran longer than the notetaker can record');
      if (state.next !== 'import') return;
      await step.do('import recording', download, () => importRecording(env, p));
      await step.do('import transcript', transcript, () => importTranscript(env, p));
      await step.do('save highlights', poll, () => importHighlights(env, p));
      await step.do('start notes', poll, () => beginAnalysis(env, p));
    } catch (error) {
      console.error('Meeting capture failed', {
        notetakerId: p.notetakerId,
        error: error instanceof Error ? error.message : String(error),
      });
      await step.do('record failure', poll, () =>
        failCapture(env, p, 'The recording could not be imported'),
      );
    }
  }
}
