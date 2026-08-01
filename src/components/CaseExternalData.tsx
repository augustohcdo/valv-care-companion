import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hospital, ChevronDown, ChevronRight } from "lucide-react";

interface Props { caseId: string; patientUserId: string | null }

/**
 * Mostra recursos FHIR recebidos de hospitais parceiros relacionados a este paciente.
 * Render é read-only: dados vêm via API key validada por grant ativo.
 */
export const externalDataKey = (patientUserId?: string | null) =>
  ["case-external-data", patientUserId] as const;

export const CaseExternalData = ({ patientUserId }: Props) => {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: externalDataKey(patientUserId),
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from("fhir_resources_inbound")
        .select("*, hospitals(trade_name, legal_name)")
        .eq("patient_id", patientUserId!)
        .order("received_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientUserId,
  });

  if (!patientUserId) return null;

  return (
    <Card className="shadow-sm-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Hospital className="h-4 w-4 text-primary" /> Dados externos (hospitais parceiros)
        </CardTitle>
        <CardDescription>Recursos FHIR R4 recebidos com consentimento do paciente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum dado externo recebido ainda.</p>
        )}
        {items.map(i => (
          <div key={i.id} className="border rounded-lg p-3">
            <button onClick={() => setOpen(o => ({ ...o, [i.id]: !o[i.id] }))}
              className="w-full flex items-center justify-between text-left text-sm">
              <div className="flex items-center gap-2">
                {open[i.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div>
                  <div className="font-medium">{i.summary || i.resource_type}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.hospitals?.trade_name ?? i.hospitals?.legal_name} · {new Date(i.received_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
              <Badge variant="outline">{i.resource_type}</Badge>
            </button>
            {open[i.id] && (
              <pre className="mt-2 p-2 bg-muted rounded text-[11px] overflow-auto max-h-64">
                {JSON.stringify(i.payload, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
