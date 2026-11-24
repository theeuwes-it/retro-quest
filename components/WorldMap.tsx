'use client';

import { LOCATIONS, STEPS, locationIndexOf } from '@/lib/shared/config';
import { FlagIcon, LocationIcon } from './art/Icons';
import { useRoomApi } from './RoomContext';

/** Left rail: the 8 locations on a dotted path. The current one glows, finished ones get a flag. */
export function WorldMap() {
  const { view, send } = useRoomApi();
  const current = locationIndexOf(view.phase);
  const furthest = locationIndexOf(STEPS[Math.min(view.furthestStep, STEPS.length - 1)].phase);
  const ended = view.phase === 'ended';

  function travel(i: number) {
    const loc = LOCATIONS[i];
    const step = STEPS.find((s) => s.phase === loc.phase)!;
    void send({ type: 'phase:set', phase: step.phase, subPhase: step.subPhase });
  }

  return (
    <nav className="map" aria-label="Quest map">
      <h2 className="pixel">World map</h2>
      <ol>
        {LOCATIONS.map((loc, i) => {
          const isCurrent = !ended && i === current;
          const finished = ended || i < current || (i <= furthest && i !== current);
          const cls = isCurrent ? 'current' : finished ? 'done' : 'future';
          const content = (
            <>
              <span className="node">
                <LocationIcon phase={loc.phase} size={22} />
                {finished && (
                  <span className="flag">
                    <FlagIcon size={16} />
                  </span>
                )}
              </span>
              <span>
                <span className="loc-name">{loc.name}</span>
                <br />
                <span className="loc-purpose">{loc.purpose}</span>
              </span>
            </>
          );
          const status = isCurrent ? ' (you are here)' : finished ? ' (visited)' : '';
          return (
            <li key={loc.phase} className={cls} aria-current={isCurrent ? 'step' : undefined}>
              {view.isHost && !ended && !isCurrent ? (
                <button className="loc" onClick={() => travel(i)} aria-label={`Travel to ${loc.name}${status}`}>
                  {content}
                </button>
              ) : (
                <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }} aria-label={`${loc.name}${status}`}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
