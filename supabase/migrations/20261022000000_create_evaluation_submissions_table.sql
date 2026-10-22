-- Crear tabla de entregas de evaluaciones (evaluation_submissions)
CREATE TABLE IF NOT EXISTS public.evaluation_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    score NUMERIC(4, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas de evaluaciones y estudiantes
CREATE INDEX IF NOT EXISTS idx_evaluation_submissions_evaluation_id 
    ON public.evaluation_submissions(evaluation_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_submissions_student_id 
    ON public.evaluation_submissions(student_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.evaluation_submissions ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Permitir todo para service_role" ON public.evaluation_submissions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Permitir lectura a autenticados" ON public.evaluation_submissions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserción a autenticados" ON public.evaluation_submissions
    FOR INSERT TO authenticated WITH CHECK (true);
