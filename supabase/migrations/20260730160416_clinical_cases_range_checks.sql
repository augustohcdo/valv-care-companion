-- Faixas fisiologicamente plausíveis para os campos numéricos clínicos.
-- Sem isso, era possível salvar FE negativa, gradiente negativo ou área
-- valvar absurda sem nenhuma camada (nem cliente, nem banco) recusar.
-- Confirmado antes de aplicar: nenhuma linha existente viola essas faixas.
ALTER TABLE public.clinical_cases
  ADD CONSTRAINT clinical_cases_ejection_fraction_range
    CHECK (ejection_fraction IS NULL OR (ejection_fraction >= 0 AND ejection_fraction <= 100)),
  ADD CONSTRAINT clinical_cases_mean_gradient_range
    CHECK (mean_gradient IS NULL OR (mean_gradient >= 0 AND mean_gradient <= 200)),
  ADD CONSTRAINT clinical_cases_peak_gradient_range
    CHECK (peak_gradient IS NULL OR (peak_gradient >= 0 AND peak_gradient <= 250)),
  ADD CONSTRAINT clinical_cases_valve_area_range
    CHECK (valve_area IS NULL OR (valve_area >= 0 AND valve_area <= 10)),
  ADD CONSTRAINT clinical_cases_patient_age_range
    CHECK (patient_age IS NULL OR (patient_age >= 0 AND patient_age <= 120));
