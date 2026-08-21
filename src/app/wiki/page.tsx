import { redirect } from 'next/navigation';

export default function WikiHome() {
  redirect('/wiki/items');
}
