'use client';

// Desktop hover card for a doll cell: the same item card the tap panel shows,
// floated next to the cell the way players expect to inspect gear. Fixed and
// pointer-transparent, so it never steals the hover that opened it; placed to
// the right of the cell when there is room, else to the left, and clamped to
// the viewport. Mounted only while hovering with a mouse at md and up.
import { createPortal } from 'react-dom';
import ItemCard from '@/components/build/ItemCard';
import type { GearItem } from '@/lib/build/gearSlots';

const WIDTH = 416; // max-w-[26rem]
const GAP = 8;
const EDGE = 8;

export default function ItemHoverCard({ item, anchor }: { item: GearItem; anchor: DOMRect }) {
  const room = window.innerWidth - anchor.right - GAP - EDGE;
  const left = room >= WIDTH ? anchor.right + GAP : Math.max(EDGE, anchor.left - GAP - WIDTH);
  // Tall cards are clamped to the viewport; the card is never taller than it.
  const top = Math.min(Math.max(EDGE, anchor.top), Math.max(EDGE, window.innerHeight - 120));
  return createPortal(
    <div
      data-testid="item-hover-card"
      style={{ position: 'fixed', left, top, width: WIDTH, maxHeight: window.innerHeight - EDGE * 2 }}
      className="pointer-events-none z-50 overflow-hidden rounded-md shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
    >
      <ItemCard item={item} compact />
    </div>,
    document.body,
  );
}
