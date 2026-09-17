type QueuedTask = {
  priority: number;
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
  run: () => Promise<unknown>;
  sequence: number;
};

export type TaskQueue = {
  <T>(run: () => Promise<T>, priority?: number): Promise<T>;
  promote: (promise: Promise<unknown>, priority: number) => void;
};

export function createTaskQueue(concurrency: number): TaskQueue {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('concurrency must be a positive integer');
  }

  const queue: QueuedTask[] = [];
  const queuedTasks = new WeakMap<Promise<unknown>, QueuedTask>();
  let activeTasks = 0;
  let sequence = 0;

  function takeNextTask(): QueuedTask | undefined {
    if (queue.length === 0) return undefined;
    let nextIndex = 0;
    for (let index = 1; index < queue.length; index += 1) {
      const candidate = queue[index];
      const current = queue[nextIndex];
      if (
        candidate.priority > current.priority
        || (candidate.priority === current.priority && candidate.sequence < current.sequence)
      ) nextIndex = index;
    }
    return queue.splice(nextIndex, 1)[0];
  }

  function drain() {
    while (activeTasks < concurrency && queue.length > 0) {
      const task = takeNextTask();
      if (!task) return;
      activeTasks += 1;
      Promise.resolve()
        .then(task.run)
        .then(task.resolve, task.reject)
        .finally(() => {
          activeTasks -= 1;
          drain();
        });
    }
  }

  const enqueue = function enqueue<T>(run: () => Promise<T>, priority = 0): Promise<T> {
    let rejectPromise!: (error: unknown) => void;
    let resolvePromise!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((resolve, reject) => {
      rejectPromise = reject;
      resolvePromise = resolve;
    });
    const task: QueuedTask = {
      priority,
      reject: rejectPromise,
      resolve: resolvePromise as (value: unknown) => void,
      run,
      sequence
    };
    sequence += 1;
    queue.push(task);
    queuedTasks.set(promise, task);
    drain();
    return promise;
  } as TaskQueue;

  enqueue.promote = (promise, priority) => {
    const task = queuedTasks.get(promise);
    if (!task || priority <= task.priority) return;
    task.priority = priority;
    drain();
  };

  return enqueue;
}

export type ProximityWarmup<T> = {
  markVisited: (key: string) => void;
  prioritize: (key: string) => void;
  takeNext: () => T | undefined;
};

export function createProximityWarmup<T>(
  items: readonly T[],
  keyForItem: (item: T) => string,
  visitedKeys: Iterable<string> = []
): ProximityWarmup<T> {
  const indexByKey = new Map(items.map((item, index) => [keyForItem(item), index]));
  const states = new Uint8Array(items.length);
  const prioritized: number[] = [];
  let fallbackIndex = items.length - 1;

  for (const key of visitedKeys) {
    const index = indexByKey.get(key);
    if (index !== undefined) states[index] = 2;
  }

  function removePrioritized(index: number) {
    const position = prioritized.indexOf(index);
    if (position >= 0) prioritized.splice(position, 1);
  }

  function appendPending(index: number) {
    if (index < 0 || index >= states.length || states[index] !== 0) return;
    if (!prioritized.includes(index)) prioritized.push(index);
  }

  function prependPending(index: number) {
    if (index < 0 || index >= states.length || states[index] !== 0) return;
    removePrioritized(index);
    prioritized.unshift(index);
  }

  function exposeNeighbours(index: number) {
    appendPending(index - 1);
    appendPending(index + 1);
  }

  states.forEach((state, index) => {
    if (state === 2) exposeNeighbours(index);
  });

  function markVisited(key: string) {
    const index = indexByKey.get(key);
    if (index === undefined || states[index] === 2) return;
    states[index] = 2;
    removePrioritized(index);
    exposeNeighbours(index);
  }

  function prioritize(key: string) {
    const index = indexByKey.get(key);
    if (index === undefined) return;
    prependPending(index + 1);
    prependPending(index - 1);
    prependPending(index);
    if (states[index] === 2) exposeNeighbours(index);
  }

  function takeNext(): T | undefined {
    while (prioritized.length > 0) {
      const index = prioritized.shift();
      if (index === undefined || states[index] !== 0) continue;
      states[index] = 1;
      return items[index];
    }
    while (fallbackIndex >= 0) {
      const index = fallbackIndex;
      fallbackIndex -= 1;
      if (states[index] !== 0) continue;
      states[index] = 1;
      return items[index];
    }
    return undefined;
  }

  return { markVisited, prioritize, takeNext };
}

export async function prewarmItems<T>(
  items: readonly T[],
  run: (item: T) => Promise<unknown>,
  {
    concurrency = 1,
    shouldContinue = () => true,
    takeNext
  }: {
    concurrency?: number;
    shouldContinue?: () => boolean;
    takeNext?: () => T | undefined;
  } = {}
): Promise<{ completed: number; failed: number; total: number }> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('concurrency must be a positive integer');
  }
  let cursor = 0;
  let completed = 0;
  let failed = 0;

  async function worker() {
    while (shouldContinue()) {
      let item: T | undefined;
      if (takeNext) {
        item = takeNext();
        if (item === undefined) return;
      } else {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        item = items[index];
      }
      try {
        await run(item);
      } catch {
        failed += 1;
      } finally {
        completed += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return { completed, failed, total: items.length };
}
