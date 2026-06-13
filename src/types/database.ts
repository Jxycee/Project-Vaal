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
      build_bookmarks: {
        Row: {
          build_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          build_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          build_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_bookmarks_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      build_tags: {
        Row: {
          build_id: string
          tag: string
        }
        Insert: {
          build_id: string
          tag: string
        }
        Update: {
          build_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_tags_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
        ]
      }
      builds: {
        Row: {
          ascendancy: string | null
          character_id: string | null
          class: string
          created_at: string
          description: string | null
          game_version: string
          gear_state: Json
          gem_state: Json
          id: string
          is_public: boolean
          league: string
          level: number
          name: string
          notes: string | null
          passive_state: Json
          share_token: string | null
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          ascendancy?: string | null
          character_id?: string | null
          class: string
          created_at?: string
          description?: string | null
          game_version?: string
          gear_state?: Json
          gem_state?: Json
          id?: string
          is_public?: boolean
          league?: string
          level?: number
          name: string
          notes?: string | null
          passive_state?: Json
          share_token?: string | null
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          ascendancy?: string | null
          character_id?: string | null
          class?: string
          created_at?: string
          description?: string | null
          game_version?: string
          gear_state?: Json
          gem_state?: Json
          id?: string
          is_public?: boolean
          league?: string
          level?: number
          name?: string
          notes?: string | null
          passive_state?: Json
          share_token?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "builds_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_progress: {
        Row: {
          character_id: string
          created_at: string
          id: string
          progress: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          progress?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          progress?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_progress_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          ascendancy: string | null
          class: string
          created_at: string
          ggg_id: string | null
          id: string
          is_imported: boolean
          last_synced_at: string | null
          league: string
          level: number
          name: string
          realm: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ascendancy?: string | null
          class: string
          created_at?: string
          ggg_id?: string | null
          id?: string
          is_imported?: boolean
          last_synced_at?: string | null
          league: string
          level?: number
          name: string
          realm?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ascendancy?: string | null
          class?: string
          created_at?: string
          ggg_id?: string | null
          id?: string
          is_imported?: boolean
          last_synced_at?: string | null
          league?: string
          level?: number
          name?: string
          realm?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_entries: {
        Row: {
          account_name: string
          ascendancy: string | null
          character_name: string
          class: string
          fetched_at: string
          league: string
          level: number
          rank: number
          realm: string
          snapshot: Json | null
        }
        Insert: {
          account_name: string
          ascendancy?: string | null
          character_name: string
          class: string
          fetched_at?: string
          league: string
          level: number
          rank: number
          realm: string
          snapshot?: Json | null
        }
        Update: {
          account_name?: string
          ascendancy?: string | null
          character_name?: string
          class?: string
          fetched_at?: string
          league?: string
          level?: number
          rank?: number
          realm?: string
          snapshot?: Json | null
        }
        Relationships: []
      }
      price_entries: {
        Row: {
          api_id: string
          category: string
          divine_value: number | null
          exalted_value: number | null
          fetched_at: string
          icon_url: string | null
          league: string
          name: string
          snapshot: Json | null
        }
        Insert: {
          api_id: string
          category: string
          divine_value?: number | null
          exalted_value?: number | null
          fetched_at?: string
          icon_url?: string | null
          league: string
          name: string
          snapshot?: Json | null
        }
        Update: {
          api_id?: string
          category?: string
          divine_value?: number | null
          exalted_value?: number | null
          fetched_at?: string
          icon_url?: string | null
          league?: string
          name?: string
          snapshot?: Json | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          ggg_access_token: string | null
          ggg_account_name: string | null
          ggg_realm: string | null
          ggg_refresh_token: string | null
          ggg_token_expires_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ggg_access_token?: string | null
          ggg_account_name?: string | null
          ggg_realm?: string | null
          ggg_refresh_token?: string | null
          ggg_token_expires_at?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ggg_access_token?: string | null
          ggg_account_name?: string | null
          ggg_realm?: string | null
          ggg_refresh_token?: string | null
          ggg_token_expires_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_build_view_count: {
        Args: { p_build_id: string }
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
  public: {
    Enums: {},
  },
} as const
