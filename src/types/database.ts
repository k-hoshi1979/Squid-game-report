/**
 * Supabase データベーススキーマの TypeScript 型定義
 * このファイルは supabase gen types typescript で自動生成可能です。
 * 現在は手動で管理しています。
 */

export type ReportStatus = "draft" | "submitted" | "revised" | "confirmed";

export type JerseySize = "S" | "M" | "L";
export type JerseyRentalType = "normal" | "sns";
export type JerseyRentalStatus = "rented" | "returned" | "cancelled";
export type IbTicketType =
  | "gen_weekday"
  | "gen_holiday"
  | "child_weekday"
  | "child_holiday"
  | "gen_vip_weekday"
  | "gen_vip_holiday"
  | "child_vip_weekday"
  | "child_vip_holiday"
  | "vip";
export type IbEntryMode = "add" | "edit";
export type RetailLogAction =
  | "jersey_rent"
  | "jersey_return"
  | "jersey_inventory_update"
  | "jersey_cleaned"
  | "ib_ticket_add"
  | "ib_ticket_edit"
  | "rollback";

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
      jersey_groups: {
        Row: {
          id: string;
          code: "A" | "B" | "C";
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: "A" | "B" | "C";
          sort_order: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: "A" | "B" | "C";
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      jersey_items: {
        Row: {
          id: string;
          group_id: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          label: string;
          sort_order: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          label?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jersey_items_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "jersey_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      jersey_cleaning_logs: {
        Row: {
          id: string;
          jersey_item_id: string;
          size: JerseySize;
          uses_before_clean: number;
          total_uses_at_clean: number;
          operator_id: string;
          cleaned_at: string;
        };
        Insert: {
          id?: string;
          jersey_item_id: string;
          size: JerseySize;
          uses_before_clean: number;
          total_uses_at_clean: number;
          operator_id: string;
          cleaned_at?: string;
        };
        Update: {
          id?: string;
          jersey_item_id?: string;
          size?: JerseySize;
          uses_before_clean?: number;
          total_uses_at_clean?: number;
          operator_id?: string;
          cleaned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jersey_cleaning_logs_jersey_item_id_fkey";
            columns: ["jersey_item_id"];
            isOneToOne: false;
            referencedRelation: "jersey_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jersey_cleaning_logs_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      jersey_inventory: {
        Row: {
          jersey_item_id: string;
          size: JerseySize;
          quantity: number;
          uses_since_clean: number;
          total_uses: number;
          last_cleaned_at: string | null;
          updated_at: string;
        };
        Insert: {
          jersey_item_id: string;
          size: JerseySize;
          quantity?: number;
          uses_since_clean?: number;
          total_uses?: number;
          last_cleaned_at?: string | null;
          updated_at?: string;
        };
        Update: {
          jersey_item_id?: string;
          size?: JerseySize;
          quantity?: number;
          uses_since_clean?: number;
          total_uses?: number;
          last_cleaned_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jersey_inventory_jersey_item_id_fkey";
            columns: ["jersey_item_id"];
            isOneToOne: false;
            referencedRelation: "jersey_items";
            referencedColumns: ["id"];
          },
        ];
      };
      jersey_rentals: {
        Row: {
          id: string;
          order_number: string;
          business_date: string;
          jersey_item_id: string;
          size: JerseySize;
          rental_type: JerseyRentalType;
          session_start_at: string;
          rented_at: string;
          returned_at: string | null;
          status: JerseyRentalStatus;
          operator_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          business_date: string;
          jersey_item_id: string;
          size: JerseySize;
          rental_type: JerseyRentalType;
          session_start_at: string;
          rented_at?: string;
          returned_at?: string | null;
          status?: JerseyRentalStatus;
          operator_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          business_date?: string;
          jersey_item_id?: string;
          size?: JerseySize;
          rental_type?: JerseyRentalType;
          session_start_at?: string;
          rented_at?: string;
          returned_at?: string | null;
          status?: JerseyRentalStatus;
          operator_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jersey_rentals_jersey_item_id_fkey";
            columns: ["jersey_item_id"];
            isOneToOne: false;
            referencedRelation: "jersey_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jersey_rentals_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ib_ticket_daily_totals: {
        Row: {
          business_date: string;
          gen_weekday_count: number;
          gen_holiday_count: number;
          child_weekday_count: number;
          child_holiday_count: number;
          gen_vip_weekday_count: number;
          gen_vip_holiday_count: number;
          child_vip_weekday_count: number;
          child_vip_holiday_count: number;
          vip_count: number;
          updated_at: string;
        };
        Insert: {
          business_date: string;
          gen_weekday_count?: number;
          gen_holiday_count?: number;
          child_weekday_count?: number;
          child_holiday_count?: number;
          gen_vip_weekday_count?: number;
          gen_vip_holiday_count?: number;
          child_vip_weekday_count?: number;
          child_vip_holiday_count?: number;
          vip_count?: number;
          updated_at?: string;
        };
        Update: {
          business_date?: string;
          gen_weekday_count?: number;
          gen_holiday_count?: number;
          child_weekday_count?: number;
          child_holiday_count?: number;
          gen_vip_weekday_count?: number;
          gen_vip_holiday_count?: number;
          child_vip_weekday_count?: number;
          child_vip_holiday_count?: number;
          vip_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      ib_ticket_entries: {
        Row: {
          id: string;
          business_date: string;
          ticket_type: IbTicketType;
          delta_count: number;
          entry_mode: IbEntryMode;
          operator_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_date: string;
          ticket_type: IbTicketType;
          delta_count: number;
          entry_mode: IbEntryMode;
          operator_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_date?: string;
          ticket_type?: IbTicketType;
          delta_count?: number;
          entry_mode?: IbEntryMode;
          operator_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ib_ticket_entries_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      retail_operation_logs: {
        Row: {
          id: string;
          business_date: string;
          action: RetailLogAction;
          target_type: string;
          target_id: string | null;
          snapshot: Record<string, unknown>;
          operator_id: string;
          performed_at: string;
          rolled_back_at: string | null;
          rolled_back_by: string | null;
        };
        Insert: {
          id?: string;
          business_date: string;
          action: RetailLogAction;
          target_type: string;
          target_id?: string | null;
          snapshot?: Record<string, unknown>;
          operator_id: string;
          performed_at?: string;
          rolled_back_at?: string | null;
          rolled_back_by?: string | null;
        };
        Update: {
          id?: string;
          business_date?: string;
          action?: RetailLogAction;
          target_type?: string;
          target_id?: string | null;
          snapshot?: Record<string, unknown>;
          operator_id?: string;
          performed_at?: string;
          rolled_back_at?: string | null;
          rolled_back_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "retail_operation_logs_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      retail_daily_report_export: {
        Row: {
          business_date: string | null;
          jersey_normal_count: number | null;
          jersey_sns_count: number | null;
          ib_gen_weekday_count: number | null;
          ib_gen_holiday_count: number | null;
          ib_child_weekday_count: number | null;
          ib_child_holiday_count: number | null;
          ib_gen_vip_weekday_count: number | null;
          ib_gen_vip_holiday_count: number | null;
          ib_child_vip_weekday_count: number | null;
          ib_child_vip_holiday_count: number | null;
          ib_vip_count: number | null;
        };
        Relationships: [];
      };
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
    Functions: {
      retail_business_date: {
        Args: { p_at?: string };
        Returns: string;
      };
      rent_jersey: {
        Args: {
          p_jersey_item_id: string;
          p_size: JerseySize;
          p_rental_type: JerseyRentalType;
          p_session_start_at: string;
          p_operator_id: string;
        };
        Returns: Tables<"jersey_rentals">;
      };
      return_jersey: {
        Args: { p_rental_id: string; p_operator_id: string };
        Returns: Tables<"jersey_rentals">;
      };
      update_jersey_inventory: {
        Args: { p_updates: unknown; p_operator_id: string };
        Returns: undefined;
      };
      mark_jersey_cleaned: {
        Args: {
          p_jersey_item_id: string;
          p_size: JerseySize;
          p_operator_id: string;
        };
        Returns: Tables<"jersey_inventory">;
      };
      add_ib_tickets: {
        Args: {
          p_business_date: string;
          p_deltas: unknown;
          p_operator_id: string;
        };
        Returns: Tables<"ib_ticket_daily_totals">;
      };
      edit_ib_tickets: {
        Args: {
          p_business_date: string;
          p_totals: unknown;
          p_operator_id: string;
        };
        Returns: Tables<"ib_ticket_daily_totals">;
      };
      rollback_retail_operation: {
        Args: { p_log_id: string; p_operator_id: string };
        Returns: Tables<"retail_operation_logs">;
      };
    };
    Enums: {
      report_status:       ReportStatus;
      message_category:    "confirmation" | "request" | "notice" | "other";
      jersey_size:         JerseySize;
      jersey_rental_type:  JerseyRentalType;
      jersey_rental_status: JerseyRentalStatus;
      ib_ticket_type:      IbTicketType;
      ib_entry_mode:       IbEntryMode;
      retail_log_action:   RetailLogAction;
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
export type RetailDailyReportExport = Views<"retail_daily_report_export">;
export type JerseyGroup = Tables<"jersey_groups">;
export type JerseyItem = Tables<"jersey_items">;
export type JerseyInventory = Tables<"jersey_inventory">;
export type JerseyRental = Tables<"jersey_rentals">;
export type IbTicketDailyTotals = Tables<"ib_ticket_daily_totals">;
export type RetailOperationLog = Tables<"retail_operation_logs">;
export type JerseyCleaningLog = Tables<"jersey_cleaning_logs">;

export type DailyReportInsert = InsertTables<"daily_reports">;
export type DailyReportUpdate = UpdateTables<"daily_reports">;

/** ユーザー情報付き日報 */
export type DailyReportWithProfile = DailyReport & {
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url" | "department">;
};
