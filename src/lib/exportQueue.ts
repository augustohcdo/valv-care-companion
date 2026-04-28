/**
 * Fila de exportações com feedback progressivo, retry e dynamic import.
 *
 * - Geradores (jspdf, csv) são carregados sob demanda via import() — bundle inicial fica leve
 * - Cada job emite estados: queued → loading → running → success | error
 * - Erros podem ser refeitos com `retry(jobId)` (mantém o mesmo run() original)
 * - Componentes assinam mudanças com `subscribe(listener)` (estilo store mínimo)
 */

export type ExportStatus = "queued" | "loading" | "running" | "success" | "error";

export interface ExportJob {
  id: string;
  label: string;
  status: ExportStatus;
  progress?: number; // 0..100, opcional
  error?: string;
  createdAt: number;
  finishedAt?: number;
  /** Função executada quando o job roda. Retorna void quando concluído. */
  run: (ctx: JobContext) => Promise<void>;
  /** Quantas tentativas já foram feitas */
  attempts: number;
}

export interface JobContext {
  setProgress: (pct: number) => void;
  setStatus: (status: Exclude<ExportStatus, "queued">) => void;
}

type Listener = (jobs: ExportJob[]) => void;

class ExportQueue {
  private jobs: ExportJob[] = [];
  private listeners = new Set<Listener>();
  private running = false;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.jobs);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const snapshot = [...this.jobs];
    this.listeners.forEach((l) => l(snapshot));
  }

  private updateJob(id: string, patch: Partial<ExportJob>) {
    this.jobs = this.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
    this.emit();
  }

  /**
   * Adiciona um job. Retorna o id gerado.
   * Mantém auto-limpeza: jobs `success` somem após 6s.
   */
  enqueue(input: { label: string; run: ExportJob["run"] }): string {
    const id = crypto.randomUUID();
    const job: ExportJob = {
      id,
      label: input.label,
      status: "queued",
      createdAt: Date.now(),
      run: input.run,
      attempts: 0,
    };
    this.jobs = [...this.jobs, job];
    this.emit();
    void this.tick();
    return id;
  }

  retry(id: string) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job || job.status !== "error") return;
    this.updateJob(id, { status: "queued", error: undefined });
    void this.tick();
  }

  dismiss(id: string) {
    this.jobs = this.jobs.filter((j) => j.id !== id);
    this.emit();
  }

  clearFinished() {
    this.jobs = this.jobs.filter(
      (j) => j.status !== "success" && j.status !== "error",
    );
    this.emit();
  }

  private async tick() {
    if (this.running) return;
    const next = this.jobs.find((j) => j.status === "queued");
    if (!next) return;
    this.running = true;

    this.updateJob(next.id, {
      status: "loading",
      attempts: next.attempts + 1,
    });

    const ctx: JobContext = {
      setProgress: (pct) => this.updateJob(next.id, { progress: Math.max(0, Math.min(100, pct)) }),
      setStatus: (status) => this.updateJob(next.id, { status }),
    };

    try {
      await next.run(ctx);
      this.updateJob(next.id, {
        status: "success",
        progress: 100,
        finishedAt: Date.now(),
      });
      // Auto-dismiss após 6s
      setTimeout(() => this.dismiss(next.id), 6000);
    } catch (err: any) {
      this.updateJob(next.id, {
        status: "error",
        error: err?.message || "Falha desconhecida",
        finishedAt: Date.now(),
      });
    } finally {
      this.running = false;
      // Continua processando próximos
      if (this.jobs.some((j) => j.status === "queued")) {
        void this.tick();
      }
    }
  }
}

export const exportQueue = new ExportQueue();
