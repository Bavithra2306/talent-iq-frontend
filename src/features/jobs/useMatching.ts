import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";

/** One matching run for a job: start it, follow its progress, and reload the job's candidates when it ends.
 *  Used by the job page so the header's "Start matching" button runs it directly. */
export function useMatching(jobId: string) {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const runStatus = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.runStatus(runId!),
    enabled: Boolean(runId),
    refetchInterval: (q) => (q.state.data?.finished ? false : 2000),
  });
  const start = useMutation({ mutationFn: () => api.startMatching(jobId), onSuccess: (r) => setRunId(r.run_id) });
  const finished = runStatus.data?.finished;
  useEffect(() => {
    if (finished) void queryClient.invalidateQueries({ queryKey: ["job-candidates", jobId] });
  }, [finished, jobId, queryClient]);
  return {
    start: () => start.mutate(),
    running: start.isPending || Boolean(runId && !finished),
    started: Boolean(runId),
    status: runStatus.data,
    error: start.error,
  };
}

export type Matching = ReturnType<typeof useMatching>;
