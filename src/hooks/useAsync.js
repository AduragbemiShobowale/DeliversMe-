import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal data-loading hook: runs `fn` when deps change, exposes loading/error/data and reload().
 * Ignores results from stale calls so fast filter changes never show old data.
 */
export function useAsync(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled });
  const callId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++callId.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === callId.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (id === callId.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (enabled) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
