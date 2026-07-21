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
      audit_logs: {
        Row: {
          action: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_table: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_table: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_table?: string
          timestamp?: string
          user_id?: string | null
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
          deleted_at: string | null
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
          prosthesis_id: string | null
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
          deleted_at?: string | null
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
          prosthesis_id?: string | null
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
          deleted_at?: string | null
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
          prosthesis_id?: string | null
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
            foreignKeyName: "clinical_cases_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_cases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_cases_prosthesis_id_fkey"
            columns: ["prosthesis_id"]
            isOneToOne: false
            referencedRelation: "prosthesis_catalog"
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
      content_review_status: {
        Row: {
          content_key: string
          content_type: string
          created_at: string
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewer_crm: string | null
          reviewer_crm_uf: string | null
          reviewer_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          content_key: string
          content_type: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewer_crm?: string | null
          reviewer_crm_uf?: string | null
          reviewer_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          content_key?: string
          content_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewer_crm?: string | null
          reviewer_crm_uf?: string | null
          reviewer_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_access_grants: {
        Row: {
          direction: string
          expires_at: string
          granted_at: string
          hospital_id: string
          id: string
          patient_id: string
          request_id: string
          resource_scopes: Database["public"]["Enums"]["fhir_resource_type"][]
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          direction: string
          expires_at: string
          granted_at?: string
          hospital_id: string
          id?: string
          patient_id: string
          request_id: string
          resource_scopes: Database["public"]["Enums"]["fhir_resource_type"][]
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          direction?: string
          expires_at?: string
          granted_at?: string
          hospital_id?: string
          id?: string
          patient_id?: string
          request_id?: string
          resource_scopes?: Database["public"]["Enums"]["fhir_resource_type"][]
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_access_grants_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_access_grants_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "data_access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      data_access_requests: {
        Row: {
          created_at: string
          decision_at: string | null
          decision_note: string | null
          direction: string
          expires_at: string
          hospital_id: string
          id: string
          patient_id: string
          patient_message: string | null
          purpose: Database["public"]["Enums"]["access_purpose"]
          purpose_details: string | null
          requested_by: string
          requesting_doctor_crm: string | null
          requesting_doctor_name: string | null
          resource_scopes: Database["public"]["Enums"]["fhir_resource_type"][]
          status: Database["public"]["Enums"]["access_request_status"]
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          decision_at?: string | null
          decision_note?: string | null
          direction?: string
          expires_at?: string
          hospital_id: string
          id?: string
          patient_id: string
          patient_message?: string | null
          purpose: Database["public"]["Enums"]["access_purpose"]
          purpose_details?: string | null
          requested_by: string
          requesting_doctor_crm?: string | null
          requesting_doctor_name?: string | null
          resource_scopes?: Database["public"]["Enums"]["fhir_resource_type"][]
          status?: Database["public"]["Enums"]["access_request_status"]
          updated_at?: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          decision_at?: string | null
          decision_note?: string | null
          direction?: string
          expires_at?: string
          hospital_id?: string
          id?: string
          patient_id?: string
          patient_message?: string | null
          purpose?: Database["public"]["Enums"]["access_purpose"]
          purpose_details?: string | null
          requested_by?: string
          requesting_doctor_crm?: string | null
          requesting_doctor_name?: string | null
          resource_scopes?: Database["public"]["Enums"]["fhir_resource_type"][]
          status?: Database["public"]["Enums"]["access_request_status"]
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_access_requests_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
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
      dpo_requests: {
        Row: {
          created_at: string
          details: string | null
          due_at: string
          id: string
          legal_basis: string | null
          requester_cpf: string | null
          requester_email: string
          requester_name: string
          responded_at: string | null
          response: string | null
          right_type: Database["public"]["Enums"]["dpo_right_type"]
          status: Database["public"]["Enums"]["dpo_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          due_at?: string
          id?: string
          legal_basis?: string | null
          requester_cpf?: string | null
          requester_email: string
          requester_name: string
          responded_at?: string | null
          response?: string | null
          right_type: Database["public"]["Enums"]["dpo_right_type"]
          status?: Database["public"]["Enums"]["dpo_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          due_at?: string
          id?: string
          legal_basis?: string | null
          requester_cpf?: string | null
          requester_email?: string
          requester_name?: string
          responded_at?: string | null
          response?: string | null
          right_type?: Database["public"]["Enums"]["dpo_right_type"]
          status?: Database["public"]["Enums"]["dpo_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fhir_resources_inbound: {
        Row: {
          case_id: string | null
          fhir_id: string | null
          grant_id: string | null
          hospital_id: string
          id: string
          patient_id: string
          payload: Json
          processed: boolean
          received_at: string
          resource_type: Database["public"]["Enums"]["fhir_resource_type"]
          summary: string | null
        }
        Insert: {
          case_id?: string | null
          fhir_id?: string | null
          grant_id?: string | null
          hospital_id: string
          id?: string
          patient_id: string
          payload: Json
          processed?: boolean
          received_at?: string
          resource_type: Database["public"]["Enums"]["fhir_resource_type"]
          summary?: string | null
        }
        Update: {
          case_id?: string | null
          fhir_id?: string | null
          grant_id?: string | null
          hospital_id?: string
          id?: string
          patient_id?: string
          payload?: Json
          processed?: boolean
          received_at?: string
          resource_type?: Database["public"]["Enums"]["fhir_resource_type"]
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fhir_resources_inbound_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "active_data_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fhir_resources_inbound_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "data_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fhir_resources_inbound_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      fhir_resources_outbound: {
        Row: {
          grant_id: string
          hospital_id: string
          id: string
          patient_id: string
          payload: Json
          requester_ip: unknown
          resource_type: Database["public"]["Enums"]["fhir_resource_type"]
          sent_at: string
        }
        Insert: {
          grant_id: string
          hospital_id: string
          id?: string
          patient_id: string
          payload: Json
          requester_ip?: unknown
          resource_type: Database["public"]["Enums"]["fhir_resource_type"]
          sent_at?: string
        }
        Update: {
          grant_id?: string
          hospital_id?: string
          id?: string
          patient_id?: string
          payload?: Json
          requester_ip?: unknown
          resource_type?: Database["public"]["Enums"]["fhir_resource_type"]
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fhir_resources_outbound_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "active_data_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fhir_resources_outbound_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "data_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fhir_resources_outbound_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          hospital_id: string
          id: string
          ip_allowlist: unknown[] | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          hospital_id: string
          id?: string
          ip_allowlist?: unknown[] | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          hospital_id?: string
          id?: string
          ip_allowlist?: unknown[] | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "hospital_api_keys_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_members: {
        Row: {
          active: boolean
          created_at: string
          hospital_id: string
          id: string
          role: Database["public"]["Enums"]["hospital_member_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          hospital_id: string
          id?: string
          role?: Database["public"]["Enums"]["hospital_member_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          hospital_id?: string
          id?: string
          role?: Database["public"]["Enums"]["hospital_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_members_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          city: string | null
          cnes: string | null
          cnpj: string
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          legal_name: string
          notes: string | null
          status: Database["public"]["Enums"]["hospital_status"]
          technical_responsible_crm: string
          technical_responsible_name: string
          technical_responsible_uf: string
          trade_name: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          cnes?: string | null
          cnpj: string
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          legal_name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["hospital_status"]
          technical_responsible_crm: string
          technical_responsible_name: string
          technical_responsible_uf: string
          trade_name?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          cnes?: string | null
          cnpj?: string
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          legal_name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["hospital_status"]
          technical_responsible_crm?: string
          technical_responsible_name?: string
          technical_responsible_uf?: string
          trade_name?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      integration_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id: string | null
          api_key_id: string | null
          created_at: string
          error_message: string | null
          hospital_id: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          patient_id: string | null
          resource_id: string | null
          resource_type:
            | Database["public"]["Enums"]["fhir_resource_type"]
            | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          api_key_id?: string | null
          created_at?: string
          error_message?: string | null
          hospital_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          patient_id?: string | null
          resource_id?: string | null
          resource_type?:
            | Database["public"]["Enums"]["fhir_resource_type"]
            | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          api_key_id?: string | null
          created_at?: string
          error_message?: string | null
          hospital_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          patient_id?: string | null
          resource_id?: string | null
          resource_type?:
            | Database["public"]["Enums"]["fhir_resource_type"]
            | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_audit_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "hospital_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_audit_log_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_secrets: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          review_status: string
          section: string | null
          source_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          review_status?: string
          section?: string | null
          source_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          review_status?: string
          section?: string | null
          source_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          citation: string | null
          created_at: string
          description: string | null
          id: string
          is_primary_br: boolean
          organization: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string
          slug: string
          title: string
          updated_at: string
          url: string | null
          year: number
        }
        Insert: {
          citation?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_primary_br?: boolean
          organization: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope: string
          slug: string
          title: string
          updated_at?: string
          url?: string | null
          year: number
        }
        Update: {
          citation?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_primary_br?: boolean
          organization?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          slug?: string
          title?: string
          updated_at?: string
          url?: string | null
          year?: number
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          {
            foreignKeyName: "patients_linked_doctor_id_fkey"
            columns: ["linked_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors_directory"
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
      prosthesis_catalog: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          effective_orifice_area: number | null
          id: string
          manufacturer: string
          model_name: string
          size: number | null
          type: Database["public"]["Enums"]["prosthesis_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          effective_orifice_area?: number | null
          id?: string
          manufacturer: string
          model_name: string
          size?: number | null
          type: Database["public"]["Enums"]["prosthesis_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          effective_orifice_area?: number | null
          id?: string
          manufacturer?: string
          model_name?: string
          size?: number | null
          type?: Database["public"]["Enums"]["prosthesis_type"]
          updated_at?: string
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
      active_data_access_grants: {
        Row: {
          direction: string | null
          expires_at: string | null
          granted_at: string | null
          hospital_id: string | null
          id: string | null
          patient_id: string | null
          request_id: string | null
          resource_scopes:
            | Database["public"]["Enums"]["fhir_resource_type"][]
            | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          direction?: string | null
          expires_at?: string | null
          granted_at?: string | null
          hospital_id?: string | null
          id?: string | null
          patient_id?: string | null
          request_id?: string | null
          resource_scopes?:
            | Database["public"]["Enums"]["fhir_resource_type"][]
            | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          direction?: string | null
          expires_at?: string | null
          granted_at?: string | null
          hospital_id?: string | null
          id?: string | null
          patient_id?: string | null
          request_id?: string | null
          resource_scopes?:
            | Database["public"]["Enums"]["fhir_resource_type"][]
            | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_access_grants_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_access_grants_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "data_access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors_directory: {
        Row: {
          city: string | null
          created_at: string | null
          crm_uf: string | null
          id: string | null
          institution: string | null
          specialty: string | null
          verified: boolean | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          crm_uf?: string | null
          id?: string | null
          institution?: string | null
          specialty?: string | null
          verified?: boolean | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          crm_uf?: string | null
          id?: string | null
          institution?: string | null
          specialty?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
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
      is_hospital_member: {
        Args: { _hospital_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner_doctor: {
        Args: { _doctor_id: string; _user_id: string }
        Returns: boolean
      }
      log_integration_event: {
        Args: {
          _action: Database["public"]["Enums"]["audit_action"]
          _actor: string
          _api_key: string
          _error: string
          _hospital_id: string
          _ip: unknown
          _meta: Json
          _patient_id: string
          _resource_id: string
          _resource_type: Database["public"]["Enums"]["fhir_resource_type"]
          _success: boolean
          _ua: string
        }
        Returns: string
      }
      match_knowledge: {
        Args: {
          filter_topic?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          review_status: string
          section: string
          similarity: number
          source_citation: string
          source_id: string
          source_organization: string
          source_scope: string
          source_title: string
          source_url: string
          source_year: number
          topic: string
        }[]
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
      access_purpose:
        | "continuidade_cuidado"
        | "segunda_opiniao"
        | "pre_operatorio"
        | "pos_operatorio"
        | "emergencia"
        | "pesquisa_consentida"
        | "outro"
      access_request_status:
        | "pendente"
        | "aprovado"
        | "recusado"
        | "expirado"
        | "revogado"
      app_role: "admin" | "medico" | "paciente" | "hospital_admin"
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
      audit_action:
        | "request_created"
        | "request_approved"
        | "request_rejected"
        | "request_expired"
        | "grant_created"
        | "grant_revoked"
        | "grant_expired"
        | "resource_received"
        | "resource_sent"
        | "api_key_created"
        | "api_key_rotated"
        | "api_key_revoked"
        | "auth_failed"
        | "rate_limited"
        | "invalid_signature"
      case_status:
        | "draft"
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
        | "cookies_functional"
        | "cookies_analytics"
        | "integracao_hospitalar"
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
      dpo_request_status:
        | "recebido"
        | "em_verificacao"
        | "atendido"
        | "negado"
        | "parcialmente_atendido"
      dpo_right_type:
        | "confirmacao"
        | "acesso"
        | "correcao"
        | "anonimizacao"
        | "portabilidade"
        | "eliminacao"
        | "compartilhamento"
        | "consentimento"
        | "revisao"
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
      fhir_resource_type:
        | "Patient"
        | "Condition"
        | "Observation"
        | "DiagnosticReport"
        | "Encounter"
        | "Procedure"
        | "MedicationStatement"
        | "AllergyIntolerance"
        | "CarePlan"
        | "DocumentReference"
      hospital_member_role: "admin_ti" | "medico_responsavel" | "operador"
      hospital_status: "pendente" | "ativo" | "suspenso" | "encerrado"
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
      prosthesis_type:
        | "biologica_aortica"
        | "biologica_mitral"
        | "anel_anuloplastia"
        | "tavi"
        | "mecanica"
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
      access_purpose: [
        "continuidade_cuidado",
        "segunda_opiniao",
        "pre_operatorio",
        "pos_operatorio",
        "emergencia",
        "pesquisa_consentida",
        "outro",
      ],
      access_request_status: [
        "pendente",
        "aprovado",
        "recusado",
        "expirado",
        "revogado",
      ],
      app_role: ["admin", "medico", "paciente", "hospital_admin"],
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
      audit_action: [
        "request_created",
        "request_approved",
        "request_rejected",
        "request_expired",
        "grant_created",
        "grant_revoked",
        "grant_expired",
        "resource_received",
        "resource_sent",
        "api_key_created",
        "api_key_rotated",
        "api_key_revoked",
        "auth_failed",
        "rate_limited",
        "invalid_signature",
      ],
      case_status: [
        "draft",
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
        "cookies_functional",
        "cookies_analytics",
        "integracao_hospitalar",
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
      dpo_request_status: [
        "recebido",
        "em_verificacao",
        "atendido",
        "negado",
        "parcialmente_atendido",
      ],
      dpo_right_type: [
        "confirmacao",
        "acesso",
        "correcao",
        "anonimizacao",
        "portabilidade",
        "eliminacao",
        "compartilhamento",
        "consentimento",
        "revisao",
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
      fhir_resource_type: [
        "Patient",
        "Condition",
        "Observation",
        "DiagnosticReport",
        "Encounter",
        "Procedure",
        "MedicationStatement",
        "AllergyIntolerance",
        "CarePlan",
        "DocumentReference",
      ],
      hospital_member_role: ["admin_ti", "medico_responsavel", "operador"],
      hospital_status: ["pendente", "ativo", "suspenso", "encerrado"],
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
      prosthesis_type: [
        "biologica_aortica",
        "biologica_mitral",
        "anel_anuloplastia",
        "tavi",
        "mecanica",
      ],
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
