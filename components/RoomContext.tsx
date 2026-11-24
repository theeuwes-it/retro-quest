'use client';

import { createContext, useContext } from 'react';
import type { ClientEvent, View, ViewPlayer } from '@/lib/shared/types';

export interface RoomApi {
  view: View;
  send: (event: ClientEvent) => Promise<boolean>;
  /** Server-synced clock (ms). */
  now: () => number;
  player: (id?: string) => ViewPlayer | undefined;
  nameOf: (id?: string) => string;
}

export const RoomContext = createContext<RoomApi | null>(null);

export function useRoomApi(): RoomApi {
  const api = useContext(RoomContext);
  if (!api) throw new Error('useRoomApi outside RoomContext');
  return api;
}
