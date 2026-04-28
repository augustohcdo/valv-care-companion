import { useEffect, useState } from "react";
import { exportQueue, ExportJob } from "@/lib/exportQueue";

/**
 * Hook reativo para a fila global de exportações.
 * Ex.: const { jobs, retry, dismiss } = useExportQueue();
 */
export function useExportQueue() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);

  useEffect(() => {
    const unsubscribe = exportQueue.subscribe(setJobs);
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    jobs,
    retry: (id: string) => exportQueue.retry(id),
    dismiss: (id: string) => exportQueue.dismiss(id),
    clearFinished: () => exportQueue.clearFinished(),
  };
}
