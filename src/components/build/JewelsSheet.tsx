'use client';

// Full-screen jewel sheet: one row per allocated tree socket, plus any
// orphaned jewels (assigned to a socket that's since been deallocated) listed
// below with a Remove action — never silently dropped. See
// docs/superpowers/specs/2026-09-20-jewels-design.md.
//
// Portaled to document.body for the same reason as GearSheet.tsx (read its
// header comment): /tree's canvas wrapper is `position: fixed`, which always
// creates its own stacking context, so a plain `fixed inset-0 z-*` here would
// sit under the shell's `sticky z-20` mobile header no matter its z-index.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ItemPickerSheet from '@/components/build/ItemPickerSheet';
import { JEWEL_PSEUDO_SLOT } from '@/lib/build/gearSlots';
import type { GearItem } from '@/lib/build/gearSlots';
import type { JewelOrphan, JewelSocketView } from '@/lib/build/jewelState';

function JewelIcon({ item }: { item: GearItem | null }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
      {item?.iconUrl ? (
        // Plain <img>, not next/image — see GearSheet.tsx's SlotRow comment
        // (this icon is under /data/wiki/, a session-cookie-protected prefix
        // next/image's server-side optimizer fetch can't carry, so it would
        // get redirected to /login instead of the image).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.iconUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] text-muted-foreground">—</span>
      )}
    </span>
  );
}

function SocketRow({
  socket,
  onOpenPicker,
  onClear,
}: {
  socket: JewelSocketView;
  onOpenPicker: () => void;
  onClear: () => void;
}) {
  return (
    <li className="border-b border-border/60">
      <div className="flex h-14 w-full items-center gap-3 px-3">
        <button
          type="button"
          onClick={onOpenPicker}
          // h-full for the same reason as GearSheet's row button: the row is
          // h-14 but a heightless button collapses to its content.
          className="flex h-full min-w-0 flex-1 items-center gap-3 text-left"
        >
          <JewelIcon item={socket.item} />
          <span className="flex min-w-0 flex-col">
            <span className="text-xs text-muted-foreground">{socket.name}</span>
            <span className="truncate text-sm text-foreground">
              {socket.item ? socket.item.name : 'Empty'}
              {socket.item?.isUnique ? (
                <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
                  {' '}
                  Unique
                </span>
              ) : null}
            </span>
          </span>
        </button>
        {socket.item ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${socket.name}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function OrphanRow({ orphan, onRemove }: { orphan: JewelOrphan; onRemove: () => void }) {
  return (
    <li className="border-b border-border/60">
      <div className="flex h-14 w-full items-center gap-3 px-3">
        <JewelIcon item={orphan.item} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">Unsocketed — was {orphan.name}</span>
          <span className="truncate text-sm text-foreground">
            {orphan.item.name}
            {orphan.item.isUnique ? (
              <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
                {' '}
                Unique
              </span>
            ) : null}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${orphan.item.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
        >
          <X size={16} />
        </button>
      </div>
    </li>
  );
}

export default function JewelsSheet({
  open,
  sockets,
  orphans,
  onPick,
  onClear,
  onClose,
}: {
  open: boolean;
  sockets: JewelSocketView[];
  orphans: JewelOrphan[];
  onPick: (socketId: string, item: GearItem) => void;
  /**
   * Discards the jewel stored at this key — a socket row's Clear, or an
   * orphan row's Remove. Both are explicit user actions, distinct from the
   * tree deallocating a socket, which must never call this (the orphan
   * rule).
   */
  onClear: (socketId: string) => void;
  onClose: () => void;
}) {
  // Keyed by socket id (as a string, matching `jewels`' own keys) rather than
  // a GearSlot — the jewel picker isn't slot-shaped, see JEWEL_PSEUDO_SLOT.
  const [pickerSocketId, setPickerSocketId] = useState<string | null>(null);

  // Also gates the SSR pass, same reasoning as GearSheet/ItemPickerSheet.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Jewels</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close jewels sheet"
          className="flex h-11 w-11 items-center justify-center text-muted-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sockets.length === 0 && orphans.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No jewel sockets allocated yet — allocate one on the tree.
          </p>
        ) : (
          <>
            {sockets.length > 0 ? (
              <ul>
                {sockets.map((socket) => (
                  <SocketRow
                    key={socket.id}
                    socket={socket}
                    onOpenPicker={() => setPickerSocketId(String(socket.id))}
                    onClear={() => onClear(String(socket.id))}
                  />
                ))}
              </ul>
            ) : null}
            {orphans.length > 0 ? (
              <>
                <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                  Unsocketed — no longer allocated on the tree
                </p>
                <ul>
                  {orphans.map((orphan) => (
                    <OrphanRow key={orphan.socketId} orphan={orphan} onRemove={() => onClear(orphan.socketId)} />
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </div>

      <ItemPickerSheet
        // Keyed by socket id: opening the picker for a different socket
        // remounts it, resetting its internal search query for free (same
        // reasoning as GearSheet's own keyed ItemPickerSheet).
        key={pickerSocketId ?? 'closed'}
        slot={JEWEL_PSEUDO_SLOT}
        open={pickerSocketId !== null}
        onPick={(item) => {
          if (pickerSocketId) onPick(pickerSocketId, item);
        }}
        onClose={() => setPickerSocketId(null)}
      />
    </div>,
    document.body,
  );
}
