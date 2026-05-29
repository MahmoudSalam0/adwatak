export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type ToolType = "jpg_to_pdf" | "pdf_merge" | "pdf_compress" | "image_compress" | "webp_to_jpg";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          user_id: string;
          tool_type: ToolType;
          status: JobStatus;
          options: Record<string, unknown>;
          progress: number;
          error_message: string | null;
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tool_type: ToolType;
          status?: JobStatus;
          options?: Record<string, unknown>;
          progress?: number;
          error_message?: string | null;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Update: {
          status?: JobStatus;
          options?: Record<string, unknown>;
          progress?: number;
          error_message?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      job_files: {
        Row: {
          id: string;
          job_id: string;
          kind: "input" | "output";
          path: string;
          mime: string | null;
          size_bytes: number | null;
          order_index: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          kind: "input" | "output";
          path: string;
          mime?: string | null;
          size_bytes?: number | null;
          order_index?: number | null;
          created_at?: string;
        };
        Update: {
          path?: string;
          mime?: string | null;
          size_bytes?: number | null;
          order_index?: number | null;
        };
        Relationships: [];
      };
      usage_logs: {
        Row: {
          id: string;
          user_id: string;
          tool_type: ToolType;
          job_id: string | null;
          duration_ms: number | null;
          input_total_bytes: number | null;
          output_total_bytes: number | null;
          status: JobStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tool_type: ToolType;
          job_id?: string | null;
          duration_ms?: number | null;
          input_total_bytes?: number | null;
          output_total_bytes?: number | null;
          status: JobStatus;
          created_at?: string;
        };
        Update: {
          duration_ms?: number | null;
          input_total_bytes?: number | null;
          output_total_bytes?: number | null;
          status?: JobStatus;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
