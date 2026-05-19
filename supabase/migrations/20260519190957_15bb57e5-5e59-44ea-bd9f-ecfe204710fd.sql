CREATE TABLE IF NOT EXISTS public.process_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT process_jobs_status_check CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  CONSTRAINT process_jobs_progress_check CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT process_jobs_job_type_check CHECK (length(trim(job_type)) > 0)
);

ALTER TABLE public.process_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_process_jobs_user_created ON public.process_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_jobs_status ON public.process_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_jobs_type_status ON public.process_jobs(job_type, status, created_at DESC);

DROP POLICY IF EXISTS "Users can create their own process jobs" ON public.process_jobs;
CREATE POLICY "Users can create their own process jobs"
ON public.process_jobs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own process jobs" ON public.process_jobs;
CREATE POLICY "Users can view their own process jobs"
ON public.process_jobs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage process jobs" ON public.process_jobs;
CREATE POLICY "Admins can manage process jobs"
ON public.process_jobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_process_jobs_updated_at ON public.process_jobs;
CREATE TRIGGER update_process_jobs_updated_at
BEFORE UPDATE ON public.process_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();