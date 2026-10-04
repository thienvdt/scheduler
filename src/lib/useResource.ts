"use client";

import { useCallback, useEffect, useState } from "react";

interface ResourceState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/**
 * Tải dữ liệu bất đồng bộ; tự tải lại khi `fetcher` đổi (hãy memo hoá bằng useCallback)
 * và bỏ qua kết quả của các lần gọi cũ để tránh race condition.
 */
export function useResource<T>(fetcher: () => Promise<T>, initial: T) {
  const [state, setState] = useState<ResourceState<T>>({ data: initial, loading: true, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let stale = false;
    fetcher().then(
      (data) => !stale && setState({ data, loading: false, error: null }),
      (err: Error) => !stale && setState((s) => ({ ...s, loading: false, error: err.message })),
    );
    return () => {
      stale = true;
    };
  }, [fetcher, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
