'use client';

// The Export button and its sheet, for ANY viewer of a build page in read
// mode: the owner and readers alike. It reuses ExportPanel (the same code +
// Copy, .build + Download + Copy and "things to know" report Build settings
// shows) but goes through the by-share-token actions, which authorise exactly
// like the page (see exportActions.ts), so a reader can export what they can
// read and nothing else. The sheet has no owner controls; Build settings stays
// the owner's separate entry. Nothing here is the security boundary.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { exportGameBuildFileByToken, exportPobCodeByToken } from '@/app/(dashboard)/builds/exportActions';
import ExportPanel from './ExportPanel';

export interface ReaderExportProps {
  shareToken: string;
  /** The checkpoint on screen: the one whose gear and gems a Path of Building export carries. */
  activeCheckpointId?: string;
}

export default function ReaderExport({ shareToken, activeCheckpointId }: ReaderExportProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Export build"
        aria-haspopup="dialog"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-foreground"
      >
        <Download size={18} aria-hidden="true" />
      </button>
      {/* Mounted only while open (and only on the client, like BuildSettings), so a result never outlives its sheet. */}
      {open && typeof document !== 'undefined'
        ? createPortal(<ExportSheet shareToken={shareToken} activeCheckpointId={activeCheckpointId} onClose={() => setOpen(false)} />, document.body)
        : null}
    </>
  );
}

function ExportSheet({ shareToken, activeCheckpointId, onClose }: ReaderExportProps & { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="reader-export" role="dialog" aria-modal="true" aria-label="Export build">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Export build</span>
        <button type="button" onClick={onClose} aria-label="Close export" className="flex h-11 w-11 items-center justify-center text-muted-foreground">
          <X size={18} />
        </button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 *:shrink-0">
        <ExportPanel
          exportCode={() => exportPobCodeByToken(shareToken, activeCheckpointId ?? null)}
          exportFile={() => exportGameBuildFileByToken(shareToken, activeCheckpointId ?? null)}
        />
      </div>
    </div>
  );
}
