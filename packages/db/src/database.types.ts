
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "key": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"appointments": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"lead_id": string,"outcome": string,"outcome_note": string | null,"scheduled_at": string,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"lead_id": string,"outcome"?: string,"outcome_note"?: string | null,"scheduled_at": string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"lead_id"?: string,"outcome"?: string,"outcome_note"?: string | null,"scheduled_at"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"entity_id": string,"entity_type": string,"event_type": string,"id": string,"payload": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"entity_id": string,"entity_type": string,"event_type": string,"id"?: string,"payload"?: NonNullable<Json>
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"event_type"?: string,"id"?: string,"payload"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"discount_note": string | null,"discount_type": string,"family_code": string,"id": string,"phone": string | null,"primary_parent_name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"discount_note"?: string | null,"discount_type"?: string,"family_code": string,"id"?: string,"phone"?: string | null,"primary_parent_name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"discount_note"?: string | null,"discount_type"?: string,"family_code"?: string,"id"?: string,"phone"?: string | null,"primary_parent_name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"installments": {
                  Row: {
                    "amount": number,"created_at": string,"due_date": string,"id": string,"marked_by": string | null,"paid_amount": number | null,"paid_at": string | null,"payment_method": string | null,"plan_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"due_date": string,"id"?: string,"marked_by"?: string | null,"paid_amount"?: number | null,"paid_at"?: string | null,"payment_method"?: string | null,"plan_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"due_date"?: string,"id"?: string,"marked_by"?: string | null,"paid_amount"?: number | null,"paid_at"?: string | null,"payment_method"?: string | null,"plan_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "installments_marked_by_fkey"
      columns: ["marked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "installments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "payment_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_notes": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"lead_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"lead_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"lead_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_notes_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "assigned_to": string | null,"beklemede_sezon": string | null,"child_birth_month": number | null,"child_birth_year": number | null,"child_name": string | null,"consent_at": string | null,"converted_student_id": string | null,"created_at": string,"family_id": string | null,"gclid": string | null,"id": string,"ingilizce_gerekli": boolean,"landing_path": string | null,"last_activity_at": string,"lost_reason": string | null,"ozel_durum": boolean,"ozel_durum_note": string | null,"parent_name": string,"phone": string,"source": string,"source_detail": string | null,"status": string,"updated_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"wants_summer": boolean,"web_payload": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"beklemede_sezon"?: string | null,"child_birth_month"?: number | null,"child_birth_year"?: number | null,"child_name"?: string | null,"consent_at"?: string | null,"converted_student_id"?: string | null,"created_at"?: string,"family_id"?: string | null,"gclid"?: string | null,"id"?: string,"ingilizce_gerekli"?: boolean,"landing_path"?: string | null,"last_activity_at"?: string,"lost_reason"?: string | null,"ozel_durum"?: boolean,"ozel_durum_note"?: string | null,"parent_name": string,"phone": string,"source": string,"source_detail"?: string | null,"status"?: string,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"wants_summer"?: boolean,"web_payload"?: Json | null
                  }
                  Update: {
                    "assigned_to"?: string | null,"beklemede_sezon"?: string | null,"child_birth_month"?: number | null,"child_birth_year"?: number | null,"child_name"?: string | null,"consent_at"?: string | null,"converted_student_id"?: string | null,"created_at"?: string,"family_id"?: string | null,"gclid"?: string | null,"id"?: string,"ingilizce_gerekli"?: boolean,"landing_path"?: string | null,"last_activity_at"?: string,"lost_reason"?: string | null,"ozel_durum"?: boolean,"ozel_durum_note"?: string | null,"parent_name"?: string,"phone"?: string,"source"?: string,"source_detail"?: string | null,"status"?: string,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"wants_summer"?: boolean,"web_payload"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_converted_student_id_fkey"
      columns: ["converted_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"payload": NonNullable<Json>,"read_at": string | null,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"type": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"offers": {
                  Row: {
                    "counter_price": number | null,"created_at": string,"created_by": string,"decided_at": string | null,"decided_by": string | null,"id": string,"installment_count": number,"lead_id": string,"list_price": number,"note": string | null,"offered_price": number,"program": string,"status": string,"superseded_by_offer_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "counter_price"?: number | null,"created_at"?: string,"created_by": string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"installment_count"?: number,"lead_id": string,"list_price": number,"note"?: string | null,"offered_price": number,"program": string,"status": string,"superseded_by_offer_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "counter_price"?: number | null,"created_at"?: string,"created_by"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"installment_count"?: number,"lead_id"?: string,"list_price"?: number,"note"?: string | null,"offered_price"?: number,"program"?: string,"status"?: string,"superseded_by_offer_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_superseded_by_offer_id_fkey"
      columns: ["superseded_by_offer_id"]
isOneToOne: false
      referencedRelation: "offers"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_plans": {
                  Row: {
                    "created_at": string,"id": string,"installment_count": number,"item_type": string,"season": string,"source_offer_id": string | null,"student_id": string,"total_amount": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"installment_count": number,"item_type": string,"season": string,"source_offer_id"?: string | null,"student_id": string,"total_amount": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"installment_count"?: number,"item_type"?: string,"season"?: string,"source_offer_id"?: string | null,"student_id"?: string,"total_amount"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_plans_source_offer_id_fkey"
      columns: ["source_offer_id"]
isOneToOne: false
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_plans_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"price_list_items": {
                  Row: {
                    "capacity": number | null,"id": string,"monthly_fee": number,"price_list_id": string,"program": string,"registration_fee": number
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number | null,"id"?: string,"monthly_fee": number,"price_list_id": string,"program": string,"registration_fee"?: number
                  }
                  Update: {
                    "capacity"?: number | null,"id"?: string,"monthly_fee"?: number,"price_list_id"?: string,"program"?: string,"registration_fee"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_list_items_price_list_id_fkey"
      columns: ["price_list_id"]
isOneToOne: false
      referencedRelation: "price_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"price_lists": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"season": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"season": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"season"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"is_active": boolean,"role": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"id": string,"is_active"?: boolean,"role": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string,"id": string,"method": string,"note": string | null,"refund_date": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by": string,"id"?: string,"method": string,"note"?: string | null,"refund_date": string,"student_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string,"id"?: string,"method"?: string,"note"?: string | null,"refund_date"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "birth_month": number | null,"birth_year": number | null,"created_at": string,"family_id": string | null,"full_name": string,"id": string,"leave_reason": string | null,"left_date": string | null,"parent_name": string | null,"phone": string | null,"program": string | null,"season": string,"start_date": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_month"?: number | null,"birth_year"?: number | null,"created_at"?: string,"family_id"?: string | null,"full_name": string,"id"?: string,"leave_reason"?: string | null,"left_date"?: string | null,"parent_name"?: string | null,"phone"?: string | null,"program"?: string | null,"season": string,"start_date"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "birth_month"?: number | null,"birth_year"?: number | null,"created_at"?: string,"family_id"?: string | null,"full_name"?: string,"id"?: string,"leave_reason"?: string | null,"left_date"?: string | null,"parent_name"?: string | null,"phone"?: string | null,"program"?: string | null,"season"?: string,"start_date"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assigned_to": string,"auto_generated": boolean,"created_at": string,"due_date": string,"id": string,"lead_id": string | null,"rule_key": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to": string,"auto_generated"?: boolean,"created_at"?: string,"due_date": string,"id"?: string,"lead_id"?: string | null,"rule_key"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string,"auto_generated"?: boolean,"created_at"?: string,"due_date"?: string,"id"?: string,"lead_id"?: string | null,"rule_key"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_counter_offer":
{ Args: { "source_offer_id": string }; Returns: string
                           },
"create_web_lead":
{ Args: { "p_consent_at": string,"p_gclid": string,"p_landing_path": string,"p_meta"?: Json,"p_parent_name": string,"p_phone": string,"p_utm": Json }; Returns: Json
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_yonetici":
{ Args: Record<PropertyKey, never>; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
