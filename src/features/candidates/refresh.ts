import type { QueryClient } from "@tanstack/react-query";

const KEYS = ["candidates", "readiness-counts", "resume-review", "categories", "quota", "failed-resumes"];

/** Reload every resume list and count. Called while a batch runs and when it finishes (twice, in case the last
 *  save lands just after the last status check), so the results show up without refreshing the page. */
export function refreshResumeLists(queryClient: QueryClient) {
  const run = () => KEYS.forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }));
  run();
  window.setTimeout(run, 1500);
}
