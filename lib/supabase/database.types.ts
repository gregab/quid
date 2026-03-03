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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ActivityLog: {
        Row: {
          action: string
          actorId: string
          createdAt: string
          groupId: string
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actorId: string
          createdAt?: string
          groupId: string
          id?: string
          payload: Json
        }
        Update: {
          action?: string
          actorId?: string
          createdAt?: string
          groupId?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ActivityLog_actorId_fkey"
            columns: ["actorId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ActivityLog_groupId_fkey"
            columns: ["groupId"]
            isOneToOne: false
            referencedRelation: "Group"
            referencedColumns: ["id"]
          },
        ]
      }
      Expense: {
        Row: {
          amountCents: number
          createdAt: string
          createdById: string | null
          date: string
          description: string
          groupId: string
          id: string
          isPayment: boolean
          paidById: string
          recurringExpenseId: string | null
          settledUp: boolean
          splitType: string
          updatedAt: string | null
        }
        Insert: {
          amountCents: number
          createdAt?: string
          createdById?: string | null
          date: string
          description: string
          groupId: string
          id?: string
          isPayment?: boolean
          paidById: string
          recurringExpenseId?: string | null
          settledUp?: boolean
          splitType?: string
          updatedAt?: string | null
        }
        Update: {
          amountCents?: number
          createdAt?: string
          createdById?: string | null
          date?: string
          description?: string
          groupId?: string
          id?: string
          isPayment?: boolean
          paidById?: string
          recurringExpenseId?: string | null
          settledUp?: boolean
          splitType?: string
          updatedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Expense_createdById_fkey"
            columns: ["createdById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_groupId_fkey"
            columns: ["groupId"]
            isOneToOne: false
            referencedRelation: "Group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_paidById_fkey"
            columns: ["paidById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_recurringExpenseId_fkey"
            columns: ["recurringExpenseId"]
            isOneToOne: false
            referencedRelation: "RecurringExpense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_recurringExpenseId_fkey"
            columns: ["recurringExpenseId"]
            isOneToOne: false
            referencedRelation: "RecurringExpenseMasked"
            referencedColumns: ["id"]
          },
        ]
      }
      ExpenseSplit: {
        Row: {
          amountCents: number
          expenseId: string
          id: string
          userId: string
        }
        Insert: {
          amountCents: number
          expenseId: string
          id?: string
          userId: string
        }
        Update: {
          amountCents?: number
          expenseId?: string
          id?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ExpenseSplit_expenseId_fkey"
            columns: ["expenseId"]
            isOneToOne: false
            referencedRelation: "Expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ExpenseSplit_expenseId_fkey"
            columns: ["expenseId"]
            isOneToOne: false
            referencedRelation: "ExpenseMasked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ExpenseSplit_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Feedback: {
        Row: {
          createdAt: string
          id: string
          message: string
          metadata: Json
          userId: string
        }
        Insert: {
          createdAt?: string
          id?: string
          message: string
          metadata?: Json
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          message?: string
          metadata?: Json
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Feedback_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Group: {
        Row: {
          bannerUrl: string | null
          createdAt: string
          createdById: string
          emoji: string | null
          id: string
          inviteToken: string
          isFriendGroup: boolean
          name: string
          patternSeed: number
        }
        Insert: {
          bannerUrl?: string | null
          createdAt?: string
          createdById: string
          emoji?: string | null
          id?: string
          inviteToken?: string
          isFriendGroup?: boolean
          name: string
          patternSeed?: number
        }
        Update: {
          bannerUrl?: string | null
          createdAt?: string
          createdById?: string
          emoji?: string | null
          id?: string
          inviteToken?: string
          isFriendGroup?: boolean
          name?: string
          patternSeed?: number
        }
        Relationships: [
          {
            foreignKeyName: "Group_createdById_fkey"
            columns: ["createdById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      GroupBill: {
        Row: {
          createdAt: string
          createdById: string
          expenseId: string | null
          groupId: string
          id: string
          name: string
          receiptImageUrl: string
          receiptType: string
          status: string
        }
        Insert: {
          createdAt?: string
          createdById: string
          expenseId?: string | null
          groupId: string
          id?: string
          name: string
          receiptImageUrl: string
          receiptType: string
          status?: string
        }
        Update: {
          createdAt?: string
          createdById?: string
          expenseId?: string | null
          groupId?: string
          id?: string
          name?: string
          receiptImageUrl?: string
          receiptType?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "GroupBill_createdById_fkey"
            columns: ["createdById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "GroupBill_expenseId_fkey"
            columns: ["expenseId"]
            isOneToOne: false
            referencedRelation: "Expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "GroupBill_expenseId_fkey"
            columns: ["expenseId"]
            isOneToOne: false
            referencedRelation: "ExpenseMasked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "GroupBill_groupId_fkey"
            columns: ["groupId"]
            isOneToOne: false
            referencedRelation: "Group"
            referencedColumns: ["id"]
          },
        ]
      }
      GroupBillItem: {
        Row: {
          amountCents: number
          claimedByUserIds: string[]
          description: string
          groupBillId: string
          id: string
          isTaxOrTip: boolean
          sortOrder: number
        }
        Insert: {
          amountCents: number
          claimedByUserIds?: string[]
          description: string
          groupBillId: string
          id?: string
          isTaxOrTip?: boolean
          sortOrder: number
        }
        Update: {
          amountCents?: number
          claimedByUserIds?: string[]
          description?: string
          groupBillId?: string
          id?: string
          isTaxOrTip?: boolean
          sortOrder?: number
        }
        Relationships: [
          {
            foreignKeyName: "GroupBillItem_groupBillId_fkey"
            columns: ["groupBillId"]
            isOneToOne: false
            referencedRelation: "GroupBill"
            referencedColumns: ["id"]
          },
        ]
      }
      GroupMember: {
        Row: {
          groupId: string
          id: string
          joinedAt: string
          userId: string
        }
        Insert: {
          groupId: string
          id?: string
          joinedAt?: string
          userId: string
        }
        Update: {
          groupId?: string
          id?: string
          joinedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "GroupMember_groupId_fkey"
            columns: ["groupId"]
            isOneToOne: false
            referencedRelation: "Group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "GroupMember_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      RecurringExpense: {
        Row: {
          amountCents: number
          createdAt: string
          createdById: string
          customSplits: Json | null
          description: string
          frequency: string
          groupId: string
          id: string
          isActive: boolean
          nextDueDate: string
          paidById: string
          participantIds: string[]
          splitType: string
        }
        Insert: {
          amountCents: number
          createdAt?: string
          createdById: string
          customSplits?: Json | null
          description: string
          frequency: string
          groupId: string
          id?: string
          isActive?: boolean
          nextDueDate: string
          paidById: string
          participantIds: string[]
          splitType?: string
        }
        Update: {
          amountCents?: number
          createdAt?: string
          createdById?: string
          customSplits?: Json | null
          description?: string
          frequency?: string
          groupId?: string
          id?: string
          isActive?: boolean
          nextDueDate?: string
          paidById?: string
          participantIds?: string[]
          splitType?: string
        }
        Relationships: [
          {
            foreignKeyName: "RecurringExpense_createdById_fkey"
            columns: ["createdById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RecurringExpense_groupId_fkey"
            columns: ["groupId"]
            isOneToOne: false
            referencedRelation: "Group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RecurringExpense_paidById_fkey"
            columns: ["paidById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          avatarUrl: string | null
          createdAt: string
          defaultEmoji: string
          displayName: string
          email: string
          id: string
          profilePictureUrl: string | null
        }
        Insert: {
          avatarUrl?: string | null
          createdAt?: string
          defaultEmoji?: string
          displayName: string
          email: string
          id?: string
          profilePictureUrl?: string | null
        }
        Update: {
          avatarUrl?: string | null
          createdAt?: string
          defaultEmoji?: string
          displayName?: string
          email?: string
          id?: string
          profilePictureUrl?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ActivityLogMasked: {
        Row: {
          action: string | null
          actorId: string | null
          createdAt: string | null
          groupId: string | null
          id: string | null
          payload: string | null
        }
        Insert: {
          action?: string | null
          actorId?: string | null
          createdAt?: string | null
          groupId?: string | null
          id?: string | null
          payload?: never
        }
        Update: {
          action?: string | null
          actorId?: string | null
          createdAt?: string | null
          groupId?: string | null
          id?: string | null
          payload?: never
        }
        Relationships: [
          {
            foreignKeyName: "ActivityLog_actorId_fkey"
            columns: ["actorId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ActivityLog_groupId_fkey"
            columns: ["groupId"]
            isOneToOne: false
            referencedRelation: "Group"
            referencedColumns: ["id"]
          },
        ]
      }
      ExpenseMasked: {
        Row: {
          amountCents: number | null
          createdAt: string | null
          createdById: string | null
          date: string | null
          description: string | null
          groupId: string | null
          id: string | null
          isPayment: boolean | null
          paidById: string | null
          recurringExpenseId: string | null
          settledUp: boolean | null
          splitType: string | null
          updatedAt: string | null
        }
        Insert: {
          amountCents?: number | null
          createdAt?: string | null
          createdById?: string | null
          date?: string | null
          description?: never
          groupId?: string | null
          id?: string | null
          isPayment?: boolean | null
          paidById?: string | null
          recurringExpenseId?: string | null
          settledUp?: boolean | null
          splitType?: string | null
          updatedAt?: string | null
        }
        Update: {
          amountCents?: number | null
          createdAt?: string | null
          createdById?: string | null
          date?: string | null
          description?: never
          groupId?: string | null
          id?: string | null
          isPayment?: boolean | null
          paidById?: string | null
          recurringExpenseId?: string | null
          settledUp?: boolean | null
          splitType?: string | null
          updatedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Expense_createdById_fkey"
            columns: ["createdById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_groupId_fkey"
            columns: ["groupId"]
            isOneToOne: false
            referencedRelation: "Group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_paidById_fkey"
            columns: ["paidById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_recurringExpenseId_fkey"
            columns: ["recurringExpenseId"]
            isOneToOne: false
            referencedRelation: "RecurringExpense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_recurringExpenseId_fkey"
            columns: ["recurringExpenseId"]
            isOneToOne: false
            referencedRelation: "RecurringExpenseMasked"
            referencedColumns: ["id"]
          },
        ]
      }
      RecurringExpenseMasked: {
        Row: {
          amountCents: number | null
          createdAt: string | null
          createdById: string | null
          customSplits: Json | null
          description: string | null
          frequency: string | null
          groupId: string | null
          id: string | null
          isActive: boolean | null
          nextDueDate: string | null
          paidById: string | null
          participantIds: string[] | null
          splitType: string | null
        }
        Insert: {
          amountCents?: number | null
          createdAt?: string | null
          createdById?: string | null
          customSplits?: Json | null
          description?: never
          frequency?: string | null
          groupId?: string | null
          id?: string | null
          isActive?: boolean | null
          nextDueDate?: string | null
          paidById?: string | null
          participantIds?: string[] | null
          splitType?: string | null
        }
        Update: {
          amountCents?: number | null
          createdAt?: string | null
          createdById?: string | null
          customSplits?: Json | null
          description?: never
          frequency?: string | null
          groupId?: string | null
          id?: string | null
          isActive?: boolean | null
          nextDueDate?: string | null
          paidById?: string | null
          participantIds?: string[] | null
          splitType?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "RecurringExpense_createdById_fkey"
            columns: ["createdById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RecurringExpense_groupId_fkey"
            columns: ["groupId"]
            isOneToOne: false
            referencedRelation: "Group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RecurringExpense_paidById_fkey"
            columns: ["paidById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_member_by_email: {
        Args: { _email: string; _group_id: string }
        Returns: Json
      }
      create_expense: {
        Args: {
          _amount_cents: number
          _date: string
          _description: string
          _group_id: string
          _paid_by_display_name: string
          _paid_by_id: string
          _participant_display_names?: string[]
          _participant_ids: string[]
          _split_amounts?: number[]
          _split_type?: string
        }
        Returns: string
      }
      create_group: { Args: { _name: string }; Returns: string }
      create_payment: {
        Args: {
          _amount_cents: number
          _date: string
          _from_display_name: string
          _group_id: string
          _paid_by_id: string
          _recipient_id: string
          _settled_up?: boolean
          _to_display_name: string
        }
        Returns: string
      }
      create_recurring_expense: {
        Args: {
          _amount_cents: number
          _date: string
          _description: string
          _frequency?: string
          _group_id: string
          _paid_by_display_name: string
          _paid_by_id: string
          _participant_display_names?: string[]
          _participant_ids: string[]
          _split_amounts?: number[]
          _split_type?: string
        }
        Returns: string
      }
      delete_account: { Args: never; Returns: undefined }
      delete_expense: {
        Args: {
          _amount_cents: number
          _date?: string
          _description: string
          _expense_id: string
          _group_id: string
          _paid_by_display_name: string
          _participant_display_names?: string[]
        }
        Returns: undefined
      }
      get_group_by_invite_token: { Args: { _token: string }; Returns: Json }
      get_or_create_friend_group: {
        Args: { _other_user_id: string }
        Returns: string
      }
      is_group_member: { Args: { _group_id: string }; Returns: boolean }
      join_group_by_token: { Args: { _token: string }; Returns: Json }
      leave_group: { Args: { _group_id: string }; Returns: Json }
      process_due_recurring_expenses: { Args: never; Returns: number }
      set_group_bill_member_all_items: {
        Args: { _bill_id: string; _include: boolean; _user_id: string }
        Returns: undefined
      }
      stop_recurring_expense: {
        Args: { _recurring_id: string }
        Returns: undefined
      }
      toggle_group_bill_item_claim: {
        Args: { _item_id: string; _user_id: string }
        Returns: string[]
      }
      update_expense: {
        Args: {
          _amount_cents: number
          _changes: Json
          _date: string
          _description: string
          _expense_id: string
          _group_id: string
          _paid_by_display_name: string
          _paid_by_id: string
          _participant_ids: string[]
          _split_amounts?: number[]
          _split_type?: string
          _splits_after?: Json
          _splits_before?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
