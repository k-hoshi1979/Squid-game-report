/**
 * Supabase データベーススキーマの TypeScript 型定義
 * このファイルは supabase gen types typescript で自動生成可能です。
 * 現在は手動で管理しています。
 */

export type ReportStatus = "draft" | "submitted" | "revised" | "confirmed";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          department: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id:         string;
          user_id:    string;
          category:   "confirmation" | "request" | "notice" | "other";
          content:    string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?:        string;
          user_id:    string;
          category:   "confirmation" | "request" | "notice" | "other";
          content:    string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?:        string;
          user_id?:   string;
          category?:  "confirmation" | "request" | "notice" | "other";
          content?:   string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      message_logs: {
        Row: {
          id:                string;
          message_id:        string;
          user_id:           string;
          user_name:         string;
          action:            "created" | "edited" | "deleted";
          content_snapshot:  string | null;
          category_snapshot: "confirmation" | "request" | "notice" | "other" | null;
          performed_at:      string;
        };
        Insert: {
          id?:               string;
          message_id:        string;
          user_id:           string;
          user_name:         string;
          action:            "created" | "edited" | "deleted";
          content_snapshot?: string | null;
          category_snapshot?: "confirmation" | "request" | "notice" | "other" | null;
          performed_at?:     string;
        };
        Update: {
          id?:               string;
          message_id?:       string;
          user_id?:          string;
          user_name?:        string;
          action?:           "created" | "edited" | "deleted";
          content_snapshot?: string | null;
          category_snapshot?: "confirmation" | "request" | "notice" | "other" | null;
          performed_at?:     string;
        };
        Relationships: [];
      };
      daily_reports: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          status: ReportStatus;
          report_date: string;
          submitted_at: string | null;
          confirmed_by: string | null;   // 確認者名（テキスト）
          confirmed_at: string | null;   // 確認日時
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: string;
          status?: ReportStatus;
          report_date?: string;
          submitted_at?: string | null;
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          status?: ReportStatus;
          report_date?: string;
          submitted_at?: string | null;
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_reports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      report_stats: {
        Row: {
          user_id: string | null;
          total_count: number | null;
          draft_count: number | null;
          submitted_count: number | null;
          revised_count: number | null;
          confirmed_count: number | null;
          this_month_count: number | null;
          last_report_date: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      report_status:     ReportStatus;
      message_category:  "confirmation" | "request" | "notice" | "other";
    };
  };
};

// ─── 便利な型エイリアス ────────────────────────────────────────────

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];

// ─── ドメインモデル ────────────────────────────────────────────────

export type Profile = Tables<"profiles">;
export type DailyReport = Tables<"daily_reports">;
export type ReportStats = Views<"report_stats">;

export type DailyReportInsert = InsertTables<"daily_reports">;
export type DailyReportUpdate = UpdateTables<"daily_reports">;

/** ユーザー情報付き日報 */
export type DailyReportWithProfile = DailyReport & {
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url" | "department">;
};
