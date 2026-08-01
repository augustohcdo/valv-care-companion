-- O resumo semanal do médico nunca chegou a ninguém.
--
-- A guarda de doctor_weekly_digest exige `auth.uid() = _doctor_user_id`. A
-- edge function weekly-digest chama o RPC com service_role, contexto em que
-- `auth.uid()` é NULL — então a guarda sempre levantava 'unauthorized'.
-- Como a função não checava o erro do rpc(), o resultado virava zero em todos
-- os contadores e o médico era pulado. A resposta era `{ok:true, sent:0}`,
-- HTTP 200, indistinguível de "ninguém tinha novidade esta semana".
--
-- A guarda passa a considerar quem está chamando. A proteção do usuário final
-- continua idêntica: um médico segue não conseguindo pedir o resumo de outro.
--
-- Segundo defeito, que só apareceu depois que a guarda deixou passar: a
-- contagem de casos graves filtra `severity IN ('grave', 'critica')`, mas
-- 'grave' não é membro do enum severity_level (leve, moderada, importante,
-- critica, indeterminada). O Postgres levanta 22P02 antes de comparar
-- qualquer linha, então a função inteira falhava para todo médico. O valor
-- correspondente é 'importante' — é o par que o resto do sistema já usa para
-- "alta gravidade" (src/lib/guidelines.ts, src/components/AdvancedStats.tsx).

CREATE OR REPLACE FUNCTION public.doctor_weekly_digest(_doctor_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_doc UUID;
  v_new_cases INTEGER;
  v_appointments INTEGER;
  v_pending INTEGER;
  v_severe INTEGER;
BEGIN
  -- service_role é o processo agendado (weekly-digest); qualquer outro
  -- chamador só pode pedir o próprio resumo.
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> _doctor_user_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT id INTO v_doc FROM public.doctors WHERE user_id = _doctor_user_id LIMIT 1;
  IF v_doc IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT COUNT(*) INTO v_new_cases FROM public.clinical_cases
  WHERE doctor_id = v_doc AND created_at >= now() - interval '7 days';

  SELECT COUNT(*) INTO v_appointments
  FROM public.appointments a JOIN public.clinical_cases c ON c.id = a.case_id
  WHERE c.doctor_id = v_doc
    AND a.scheduled_at BETWEEN now() AND now() + interval '7 days'
    AND a.status = 'agendado';

  SELECT COUNT(*) INTO v_pending FROM public.cases_pending_action(_doctor_user_id);

  SELECT COUNT(*) INTO v_severe FROM public.clinical_cases
  WHERE doctor_id = v_doc AND severity IN ('importante', 'critica')
    AND status NOT IN ('alta', 'arquivado');

  RETURN jsonb_build_object(
    'new_cases', v_new_cases,
    'upcoming_appointments', v_appointments,
    'pending_action', v_pending,
    'active_severe', v_severe
  );
END;
$$;
