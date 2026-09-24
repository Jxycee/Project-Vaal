/**
 * The vendored passive-tree export version (see
 * public/data/tree/<version>/SOURCE.md). The one place it is written.
 *
 * Lives here rather than in TreeEditor.tsx, where it used to: that file is a
 * 'use client' module, and server code importing a value from one receives a
 * client-reference proxy, not the string. The PoB importer's catalogue is
 * server code that needs the real value.
 *
 * Not to be confused with PassiveTree.tsx's local `TREE_VERSION = '0_5'`,
 * which is the format tag normalizeGggTree expects, not a data folder.
 */
export const TREE_VERSION = '0.5.2';
