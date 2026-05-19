import { supabase } from "@/integrations/supabase/client";

export type ProcessJobStatus = "pending" | "processing" | "completed" | "error";

export interface ProcessJob {
  id: string;
  user_id: string;
  job_type: string;
  status: ProcessJobStatus;
  progress: number;
  message: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createProcessJob(
  jobType: string,
  payload: Record<string, unknown> = {},
  message = "Aguardando processamento",
): Promise<ProcessJob> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("process_jobs" as any)
    .insert({ user_id: userId, job_type: jobType, payload, message, status: "pending", progress: 0 } as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProcessJob;
}

export async function updateProcessJob(
  jobId: string,
  changes: Partial<Pick<ProcessJob, "status" | "progress" | "message" | "result" | "error" | "started_at" | "completed_at">>,
) {
  const { error } = await supabase.from("process_jobs" as any).update(changes as any).eq("id", jobId);
  if (error) throw error;
}

export async function getProcessJob(jobId: string): Promise<ProcessJob | null> {
  const { data, error } = await supabase.from("process_jobs" as any).select("*").eq("id", jobId).maybeSingle();
  if (error) throw error;
  return (data as ProcessJob | null) ?? null;
}

export async function listRecentProcessJobs(jobType?: string, limit = 20): Promise<ProcessJob[]> {
  let query = supabase
    .from("process_jobs" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (jobType) query = query.eq("job_type", jobType);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProcessJob[];
}