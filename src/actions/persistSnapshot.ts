const DEFAULT_EVENTS: string[] = ['input', 'change'];

export type SnapshotPersistOptions<T> = {
  getSnapshot: () => T;
  onPersist: (value: T) => void;
  compare?: (a: T, b: T) => boolean;
  clone?: (value: T) => T;
  events?: string[];
  capture?: boolean;
  initial?: T;
};

export type SnapshotPersistHandle<T> = {
  action: (node: HTMLElement) => { destroy(): void };
  setBaseline: (value: T) => void;
  flush: () => void;
};

export function createSnapshotPersistAction<T>(
  options: SnapshotPersistOptions<T>
): SnapshotPersistHandle<T> {
  const {
    getSnapshot,
    onPersist,
    compare = Object.is,
    clone = (value: T) => value,
    events = DEFAULT_EVENTS,
    capture = true,
    initial,
  } = options;

  let baseline = clone(initial !== undefined ? initial : getSnapshot());

  const handler = () => {
    const next = getSnapshot();
    if (compare(baseline, next)) {
      return;
    }
    baseline = clone(next);
    onPersist(next);
  };

  const action = (node: HTMLElement) => {
    for (const eventName of events) {
      node.addEventListener(eventName, handler, capture);
    }
    return {
      destroy() {
        for (const eventName of events) {
          node.removeEventListener(eventName, handler, capture);
        }
      },
    };
  };

  return {
    action,
    setBaseline(value: T) {
      baseline = clone(value);
    },
    flush() {
      handler();
    },
  };
}
