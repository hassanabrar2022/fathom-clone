import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { LoaderCircle, Trash2, X } from 'lucide-react';
import { deleteMeetingResultSchema } from '../../../../packages/shared/ingestion';
import { uploadApi } from '../data/uploads';

export function DeleteMeetingControl({
  meetingId,
  meetingTitle,
  disabled = false,
  onDeleted,
}: {
  meetingId: string;
  meetingTitle: string;
  disabled?: boolean;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      deleteMeetingResultSchema.parse(
        await uploadApi(`uploads/${meetingId}`, 'DELETE'),
      );
      try {
        window.localStorage.removeItem(`fathom-clone:moments:${meetingId}:v1`);
        window.localStorage.removeItem(`fathom-clone:speakers:${meetingId}:v1`);
      } catch {
        // Server-side deletion succeeded; unavailable local storage is harmless.
      }
      onDeleted();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'This meeting could not be deleted. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (next) setError('');
      }}
    >
      <Dialog.Trigger
        className="delete-meeting-trigger"
        disabled={disabled}
        title={
          disabled
            ? 'Wait for the current upload or processing step to finish.'
            : undefined
        }
      >
        <Trash2 size={15} aria-hidden="true" /> Delete meeting
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content delete-meeting-dialog">
          <span className="delete-dialog-icon" aria-hidden="true">
            <Trash2 size={20} />
          </span>
          <Dialog.Title>Delete “{meetingTitle}”?</Dialog.Title>
          <Dialog.Description>
            This permanently removes the recording, transcript, summaries,
            speaker labels, and any public meeting link. This cannot be undone.
          </Dialog.Description>
          {error && (
            <p className="delete-dialog-error" role="alert">
              {error}
            </p>
          )}
          <div className="delete-dialog-actions">
            <Dialog.Close className="secondary-button" disabled={busy}>
              Cancel
            </Dialog.Close>
            <button
              type="button"
              className="delete-confirm-button"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? (
                <>
                  <LoaderCircle className="loading-icon" size={15} /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 size={15} /> Delete permanently
                </>
              )}
            </button>
          </div>
          <Dialog.Close
            className="icon-button dialog-close"
            aria-label="Close delete dialog"
            disabled={busy}
          >
            <X size={19} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
