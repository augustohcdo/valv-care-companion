import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PainelDeFerramentas } from "@/components/ferramentas/PainelDeFerramentas";
import { euroscoreDoCaso, mismatchDoCaso, type CasoParaFerramentas } from "@/lib/ferramentasDoCaso";

/**
 * As mesmas ferramentas livres, dentro da conta — e com o caso já preenchido.
 *
 * O "a mais" de ter conta é este: `?caso=<id>` traz idade, sexo, NYHA, função
 * ventricular, gradiente e a prótese escolhida direto do caso clínico, em vez
 * de o médico redigitar. O que o caso **não** sabe continua em branco, e não
 * preenchido com um palpite — a regra de sempre.
 */
const MedicoFerramentas = () => {
  const [params] = useSearchParams();
  const casoId = params.get("caso");

  const { data: caso } = useQuery({
    queryKey: ["caso-para-ferramentas", casoId],
    enabled: !!casoId,
    queryFn: async (): Promise<CasoParaFerramentas | null> => {
      const { data, error } = await supabase
        .from("clinical_cases")
        .select("id, patient_name, patient_age, patient_sex, nyha, ejection_fraction, mean_gradient, valve_type, prosthesis_id")
        .eq("id", casoId!)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Apoio à decisão"
        title="Ferramentas"
        description="EuroSCORE II, gradiente e risco de mismatch, e o catálogo de próteses. As mesmas que estão abertas em /ferramentas — aqui elas chegam preenchidas a partir do caso."
      />

      {casoId && (
        <Card className="mb-6">
          <CardContent className="pt-6 flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              {caso ? (
                <>
                  <p className="text-foreground">
                    Preenchido a partir do caso de <strong>{caso.patient_name}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Só vieram os campos que o caso registra. O que ficou em branco continua em
                    branco de propósito: o caso não sabe, e supor seria inventar.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Carregando os dados do caso…</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <PainelDeFerramentas
        base="/app/medico/ferramentas"
        euroscore={euroscoreDoCaso(caso ?? null)}
        mismatch={mismatchDoCaso(caso ?? null)}
      />
    </>
  );
};

export default MedicoFerramentas;
