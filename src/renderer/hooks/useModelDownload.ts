import { useState, useEffect, useRef, useCallback } from 'react';
import { startModelDownload, getModelDownloadProgress, type ModelDownloadProgressResponse } from '../../api';

export interface DownloadState {
  [modelId: string]: ModelDownloadProgressResponse;
}

/**
 * 管理模型下载与进度轮询。
 * - start(modelId): 异步启动后端下载
 * - 轮询所有"非 idle/done"的模型,每秒一次
 * - 下载完成自动停止轮询
 */
export function useModelDownload(onDone?: (modelId: string) => void) {
  const [progress, setProgress] = useState<DownloadState>({});
  const activeRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const poll = useCallback(async () => {
    const targets = Array.from(activeRef.current);
    if (targets.length === 0) return;
    const next: DownloadState = {};
    let anyActive = false;
    await Promise.all(targets.map(async (id) => {
      try {
        const p = await getModelDownloadProgress(id);
        next[id] = p;
        if (p.status === 'done') {
          activeRef.current.delete(id);
          onDoneRef.current?.(id);
        } else if (p.status === 'error') {
          activeRef.current.delete(id);
        } else {
          anyActive = true;
        }
      } catch (e) {
        console.warn('Failed to fetch progress for', id, e);
      }
    }));
    setProgress(prev => ({ ...prev, ...next }));
    if (!anyActive && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const ensurePolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => { void poll(); }, 1000);
  }, [poll]);

  const start = useCallback(async (modelId: string) => {
    try {
      const res = await startModelDownload(modelId);
      if (res.success) {
        if (res.already_exists) {
          setProgress(prev => ({
            ...prev,
            [modelId]: { status: 'done', percent: 100, downloaded: 0, total: 0, speed_bps: 0 },
          }));
          return res;
        }
        activeRef.current.add(modelId);
        setProgress(prev => ({
          ...prev,
          [modelId]: prev[modelId]?.status === 'downloading'
            ? prev[modelId]
            : { status: 'downloading', percent: 0, downloaded: 0, total: 0, speed_bps: 0 },
        }));
        ensurePolling();
      }
      return res;
    } catch (e) {
      setProgress(prev => ({
        ...prev,
        [modelId]: { status: 'error', percent: 0, downloaded: 0, total: 0, speed_bps: 0, error: String(e) },
      }));
      throw e;
    }
  }, [ensurePolling]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return { progress, start };
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatSpeed(bps: number): string {
  if (!bps || bps <= 0) return '—';
  return `${formatBytes(bps)}/s`;
}
