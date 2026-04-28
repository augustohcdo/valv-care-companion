export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          description: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          case_id: string
          created_at?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          case_id?: string
          created_at?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "clinical_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_cases: {
        Row: {
          clinical_notes: string | null
          comorbidities: string[] | null
          created_at: string
          doctor_id: string
          ejection_fraction: number | null
          id: string
          mean_gradient: number | null
          nyha: Database["public"]["Enums"]["nyha_class"] | null
          patient_age: number | null
          patient_id: string | null
          patient_name: string
          patient_sex: string | null
          peak_gradient: number | null
          proposed_management: string | null
          regurgitation_grade: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["case_status"]
          symptoms: string[] | null
          updated_at: string
          valve_area: number | null
          valve_disease: Database["public"]["Enums"]["valve_disease"]
          valve_type: Database["public"]["Enums"]["valve_type"]
        }
        Insert: {
          clinical_notes?: string | null
          comorbidities?: string[] | null
          created_at?: string
          doctor_id: string
          ejection_fraction?: number | null
          id?: string
          mean_gradient?: number | null
          nyha?: Database["public"]["Enums"]["nyha_class"] | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name: string
          patient_sex?: string | null
          peak_gradient?: number | null
          proposed_management?: string | null
          regurgitation_grade?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["case_status"]
          symptoms?: string[] | null
          updated_at?: string
          valve_area?: number | null
          valve_disease: Database["public"]["Enums"]["valve_disease"]
          valve_type: Database["public"]["Enums"]["valve_type"]
        }
        Update: {
          clinical_notes?: string | null
          comorbidities?: string[] | null
          created_at?: string
          doctor_id?: string
          ejection_fraction?: number | null
          id?: string
          mean_gradient?: number | null
          nyha?: Database["public"]["Enums"]["nyha_class"] | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name?: string
          patient_sex?: string | null
          peak_gradient?: number | null
          proposed_management?: string | null
          regurgitation_grade?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["case_status"]
          symptoms?: string[] | null
          updated_at?: string
          valve_area?: number | null
          valve_disease?: Database["public"]["Enums"]["valve_disease"]
          valve_type?: Database["public"]["Enums"]["valve_type"]
        }
        Relationships: [
          {
            foreignKeyName: "clinical_cases_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_cases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          crm: string
          crm_uf: string
          id: string
          institution: string | null
          rqe: string | null
          specialty: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          crm: string
          crm_uf: string
          id?: string
          institution?: string | null
          rqe?: string | null
          specialty: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          crm?: string
          crm_uf?: string
          id?: string
          institution?: string | null
          rqe?: string | null
          specialty?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      patients: {
        Row: {
          city: string | null
          comorbidities: string[] | null
          created_at: string
          id: string
          linked_at: string | null
          linked_doctor_id: string | null
          sex: string | null
          uf: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          comorbidities?: string[] | null
          created_at?: string
          id?: string
          linked_at?: string | null
          linked_doctor_id?: string | null
          sex?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          comorbidities?: string[] | null
          created_at?: string
          id?: string
          linked_at?: string | null
          linked_doctor_id?: string | null
          sex?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_linked_doctor_id_fkey"
            columns: ["linked_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          birth_date: string | null
          created_at: string
          full_name: string
          id: string
          lgpd_accepted_at: string | null
          phone: string | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: string
          birth_date?: string | null
          created_at?: string
          full_name: string
          id?: string
          lgpd_accepted_at?: string | null
          phone?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          birth_date?: string | null
          created_at?: string
          full_name?: string
          id?: string
          lgpd_accepted_at?: string | null
          phone?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_case: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "medico" | "paciente"
      case_status:
        | "avaliacao_inicial"
        | "em_seguimento"
        | "pre_intervencao"
        | "pos_intervencao"
        | "alta"
        | "arquivado"
      document_type:
        | "ecocardiograma"
        | "ressonancia"
        | "tomografia"
        | "cateterismo"
        | "eletrocardiograma"
        | "laudo_medico"
        | "receita"
        | "exame_laboratorial"
        | "outro"
      nyha_class: "I" | "II" | "III" | "IV"
      severity_level:
        | "leve"
        | "moderada"
        | "importante"
        | "critica"
        | "indeterminada"
      valve_disease:
        | "estenose"
        | "insuficiencia"
        | "mista"
        | "prolapso"
        | "protese_disfuncao"
        | "outra"
      valve_type: "aortica" | "mitral" | "tricuspide" | "pulmonar" | "multipla"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "medico", "paciente"],
      case_status: [
        "avaliacao_inicial",
        "em_seguimento",
        "pre_intervencao",
        "pos_intervencao",
        "alta",
        "arquivado",
      ],
      document_type: [
        "ecocardiograma",
        "ressonancia",
        "tomografia",
        "cateterismo",
        "eletrocardiograma",
        "laudo_medico",
        "receita",
        "exame_laboratorial",
        "outro",
      ],
      nyha_class: ["I", "II", "III", "IV"],
      severity_level: [
        "leve",
        "moderada",
        "importante",
        "critica",
        "indeterminada",
      ],
      valve_disease: [
        "estenose",
        "insuficiencia",
        "mista",
        "prolapso",
        "protese_disfuncao",
        "outra",
      ],
      valve_type: ["aortica", "mitral", "tricuspide", "pulmonar", "multipla"],
    },
  },
} as const
