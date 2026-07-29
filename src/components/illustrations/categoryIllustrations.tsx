import { HeartValveIllustration } from "./HeartValveIllustration";
import { DiseaseIllustration } from "./DiseaseIllustration";
import { ExamIllustration } from "./ExamIllustration";
import { TreatmentIllustration } from "./TreatmentIllustration";
import { JourneyIllustration } from "./JourneyIllustration";
import { HeartTeamIllustration } from "./HeartTeamIllustration";

/** Ilustração associada a cada categoria de conteúdo de /aprender. */
export const categoryIllustrations: Record<string, React.ComponentType<{ className?: string }>> = {
  fundamentos: HeartValveIllustration,
  doencas: DiseaseIllustration,
  exames: ExamIllustration,
  tratamentos: TreatmentIllustration,
  jornada: JourneyIllustration,
  aprofundamento: HeartTeamIllustration,
};
