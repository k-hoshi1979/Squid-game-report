export type MessageCategory = "confirmation" | "request" | "notice" | "other";
export type MessageLogAction = "created" | "edited" | "deleted";

export const CATEGORY_CONFIG: Record<
  MessageCategory,
  { label: string; textColor: string; bgColor: string; borderColor: string }
> = {
  confirmation: {
    label:       "確認",
    textColor:   "text-green-700 dark:text-green-400",
    bgColor:     "bg-green-100 dark:bg-green-900/20",
    borderColor: "border-green-300 dark:border-green-700",
  },
  request: {
    label:       "依頼",
    textColor:   "text-orange-700 dark:text-orange-400",
    bgColor:     "bg-orange-100 dark:bg-orange-900/20",
    borderColor: "border-orange-300 dark:border-orange-700",
  },
  notice: {
    label:       "連絡",
    textColor:   "text-blue-700 dark:text-blue-400",
    bgColor:     "bg-blue-100 dark:bg-blue-900/20",
    borderColor: "border-blue-300 dark:border-blue-700",
  },
  other: {
    label:       "その他",
    textColor:   "text-gray-600 dark:text-gray-400",
    bgColor:     "bg-gray-100 dark:bg-gray-800",
    borderColor: "border-gray-300 dark:border-gray-600",
  },
};

export interface Message {
  id:         string;
  user_id:    string;
  category:   MessageCategory;
  content:    string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MessageWithAuthor extends Message {
  profiles: {
    full_name: string | null;
    email:     string;
  } | null;
}

export interface MessageLog {
  id:                string;
  message_id:        string;
  user_id:           string;
  user_name:         string;
  action:            MessageLogAction;
  content_snapshot:  string | null;
  category_snapshot: MessageCategory | null;
  performed_at:      string;
}
