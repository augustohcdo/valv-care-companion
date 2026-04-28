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
      appointments: {
        Row: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          case_id: string
          created_at: string
          created_by: string
          duration_minutes: number
          id: string
          location: string | null
          notes: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          case_id: string
          created_at?: string
          created_by: string
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          case_id?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: []
      }
      case_collaborators: {
        Row: {
          access_level: Database["public"]["Enums"]["collaborator_access"]
          case_id: string
          created_at: string
          doctor_id: string
          id: string
          invited_by: string
          message: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["collaborator_status"]
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["collaborator_access"]
          case_id: string
          created_at?: string
          doctor_id: string
          id?: string
          invited_by: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["collaborator_status"]
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["collaborator_access"]
          case_id?: string
          created_at?: string
          doctor_id?: string
          id?: string
          invited_by?: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["collaborator_status"]
          updated_at?: string
        }
        Relationships: []
      }
      case_comments: {
        Row: {
          author_doctor_id: string | null
          author_id: string
          body: string
          case_id: string
          created_at: string
          id: string
          is_heart_team_decision: boolean
          updated_at: string
        }
        Insert: {
          author_doctor_id?: string | null
          author_id: string
          body: string
          case_id: string
          created_at?: string
          id?: string
          is_heart_team_decision?: boolean
          updated_at?: string
        }
        Update: {
          author_doctor_id?: string | null
          author_id?: string
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          is_heart_team_decision?: boolean
          updated_at?: string
        }
        Relationships: []
      }
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
      case_events: {
        Row: {
          case_id: string
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          metadata: Json | null
          title: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by: string
          description?: string | null
          event_date?: string
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          metadata?: Json | null
          title: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          metadata?: Json | null
          title?: string
        }
        Relationships: []
      }
      case_exams: {
        Row: {
          bnp: number | null
          case_id: string
          created_at: string
          created_by: string
          document_id: string | null
          ejection_fraction: number | null
          exam_date: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          id: string
          lv_diameter: number | null
          mean_gradient: number | null
          notes: string | null
          nt_probnp: number | null
          peak_gradient: number | null
          psap: number | null
          regurgitation_grade: string | null
          septal_thickness: number | null
          six_min_walk: number | null
          title: string | null
          updated_at: string
          valve_area: number | null
        }
        Insert: {
          bnp?: number | null
          case_id: string
          created_at?: string
          created_by: string
          document_id?: string | null
          ejection_fraction?: number | null
          exam_date?: string
          exam_type?: Database["public"]["Enums"]["exam_type"]
          id?: string
          lv_diameter?: number | null
          mean_gradient?: number | null
          notes?: string | null
          nt_probnp?: number | null
          peak_gradient?: number | null
          psap?: number | null
          regurgitation_grade?: string | null
          septal_thickness?: number | null
          six_min_walk?: number | null
          title?: string | null
          updated_at?: string
          valve_area?: number | null
        }
        Update: {
          bnp?: number | null
          case_id?: string
          created_at?: string
          created_by?: string
          document_id?: string | null
          ejection_fraction?: number | null
          exam_date?: string
          exam_type?: Database["public"]["Enums"]["exam_type"]
          id?: string
          lv_diameter?: number | null
          mean_gradient?: number | null
          notes?: string | null
          nt_probnp?: number | null
          peak_gradient?: number | null
          psap?: number | null
          regurgitation_grade?: string | null
          septal_thickness?: number | null
          six_min_walk?: number | null
          title?: string | null
          updated_at?: string
          valve_area?: number | null
        }
        Relationships: []
      }
      case_messages: {
        Row: {
          body: string
          case_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_role: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: []
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
      consent_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["consent_action"]
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          document_version: string
          id: string
          ip_address: string | null
          metadata: Json | null
          source: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["consent_action"]
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          document_version?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          source?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["consent_action"]
          consent_type?: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          document_version?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          source?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      medication_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          medication_id: string
          notes: string | null
          patient_id: string
          scheduled_time: string
          status: Database["public"]["Enums"]["medication_log_status"]
          taken_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          medication_id: string
          notes?: string | null
          patient_id: string
          scheduled_time: string
          status?: Database["public"]["Enums"]["medication_log_status"]
          taken_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          medication_id?: string
          notes?: string | null
          patient_id?: string
          scheduled_time?: string
          status?: Database["public"]["Enums"]["medication_log_status"]
          taken_at?: string | null
        }
        Relationships: []
      }
      medications: {
        Row: {
          active: boolean
          created_at: string
          dose: string | null
          end_date: string | null
          frequency: string | null
          id: string
          name: string
          notes: string | null
          patient_id: string
          prescribed_by: string | null
          start_date: string
          times: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name: string
          notes?: string | null
          patient_id: string
          prescribed_by?: string | null
          start_date?: string
          times?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name?: string
          notes?: string | null
          patient_id?: string
          prescribed_by?: string | null
          start_date?: string
          times?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read?: boolean
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      patient_documents: {
        Row: {
          created_at: string
          description: string | null
          document_type: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          patient_id: string
          shared_with_doctor: boolean
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          patient_id: string
          shared_with_doctor?: boolean
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          patient_id?: string
          shared_with_doctor?: boolean
          storage_path?: string
          uploaded_by?: string
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
      saved_filters: {
        Row: {
          config: Json
          created_at: string
          icon: string | null
          id: string
          name: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      symptom_entries: {
        Row: {
          bp_diastolic: number | null
          bp_systolic: number | null
          chest_pain: number | null
          created_at: string
          dyspnea: number | null
          edema: boolean
          entry_date: string
          fatigue: number | null
          id: string
          notes: string | null
          orthopnea: boolean
          palpitations: number | null
          patient_id: string
          syncope: boolean
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          bp_diastolic?: number | null
          bp_systolic?: number | null
          chest_pain?: number | null
          created_at?: string
          dyspnea?: number | null
          edema?: boolean
          entry_date?: string
          fatigue?: number | null
          id?: string
          notes?: string | null
          orthopnea?: boolean
          palpitations?: number | null
          patient_id: string
          syncope?: boolean
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          bp_diastolic?: number | null
          bp_systolic?: number | null
          chest_pain?: number | null
          created_at?: string
          dyspnea?: number | null
          edema?: boolean
          entry_date?: string
          fatigue?: number | null
          id?: string
          notes?: string | null
          orthopnea?: boolean
          palpitations?: number | null
          patient_id?: string
          syncope?: boolean
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          document_version: string
          granted: boolean
          granted_at: string | null
          id: string
          revoked_at: string | null
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          document_version?: string
          granted: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_type?: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          document_version?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          source?: string | null
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
      can_comment_case: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      cases_pending_action: {
        Args: { _doctor_user_id: string }
        Returns: {
          case_id: string
          days_inactive: number
          last_activity: string
          patient_name: string
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["case_status"]
        }[]
      }
      create_notification: {
        Args: {
          _body?: string
          _link?: string
          _metadata?: Json
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      doctor_weekly_digest: { Args: { _doctor_user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_case_owner: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner_doctor: {
        Args: { _doctor_id: string; _user_id: string }
        Returns: boolean
      }
      register_consent: {
        Args: {
          _consent_type: Database["public"]["Enums"]["consent_type"]
          _document_version?: string
          _granted: boolean
          _ip_address?: string
          _metadata?: Json
          _source?: string
          _user_agent?: string
        }
        Returns: string
      }
      search_global: {
        Args: { _query: string; _user_id: string }
        Returns: {
          link: string
          result_id: string
          result_type: string
          subtitle: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "medico" | "paciente"
      appointment_status:
        | "agendado"
        | "realizado"
        | "cancelado"
        | "remarcado"
        | "faltou"
      appointment_type:
        | "consulta_retorno"
        | "exame"
        | "procedimento"
        | "cirurgia"
        | "teleconsulta"
      case_status:
        | "avaliacao_inicial"
        | "em_seguimento"
        | "pre_intervencao"
        | "pos_intervencao"
        | "alta"
        | "arquivado"
      collaborator_access: "leitura" | "comentar"
      collaborator_status: "pendente" | "aceito" | "recusado" | "removido"
      consent_action: "granted" | "revoked"
      consent_type:
        | "terms_of_use"
        | "privacy_policy"
        | "medical_disclaimer"
        | "data_sharing_doctor"
        | "email_communications"
        | "ai_processing"
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
      event_type:
        | "consulta"
        | "exame"
        | "cirurgia"
        | "internacao"
        | "alta"
        | "mudanca_nyha"
        | "mudanca_severidade"
        | "observacao"
        | "medicacao"
      exam_type:
        | "eco"
        | "ecg"
        | "bnp"
        | "ergometria"
        | "hemodinamica"
        | "ressonancia"
        | "tomografia"
        | "outro"
      medication_log_status: "tomado" | "atrasado" | "esquecido" | "pulado"
      notification_type:
        | "patient_linked"
        | "patient_unlinked"
        | "case_created"
        | "case_updated"
        | "document_uploaded"
        | "document_shared"
        | "system"
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
      appointment_status: [
        "agendado",
        "realizado",
        "cancelado",
        "remarcado",
        "faltou",
      ],
      appointment_type: [
        "consulta_retorno",
        "exame",
        "procedimento",
        "cirurgia",
        "teleconsulta",
      ],
      case_status: [
        "avaliacao_inicial",
        "em_seguimento",
        "pre_intervencao",
        "pos_intervencao",
        "alta",
        "arquivado",
      ],
      collaborator_access: ["leitura", "comentar"],
      collaborator_status: ["pendente", "aceito", "recusado", "removido"],
      consent_action: ["granted", "revoked"],
      consent_type: [
        "terms_of_use",
        "privacy_policy",
        "medical_disclaimer",
        "data_sharing_doctor",
        "email_communications",
        "ai_processing",
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
      event_type: [
        "consulta",
        "exame",
        "cirurgia",
        "internacao",
        "alta",
        "mudanca_nyha",
        "mudanca_severidade",
        "observacao",
        "medicacao",
      ],
      exam_type: [
        "eco",
        "ecg",
        "bnp",
        "ergometria",
        "hemodinamica",
        "ressonancia",
        "tomografia",
        "outro",
      ],
      medication_log_status: ["tomado", "atrasado", "esquecido", "pulado"],
      notification_type: [
        "patient_linked",
        "patient_unlinked",
        "case_created",
        "case_updated",
        "document_uploaded",
        "document_shared",
        "system",
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
