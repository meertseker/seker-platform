
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ad_spend_daily": {
                  Row: {
                    "campaign_id": string,"campaign_name": string,"clicks": number,"cost_micros": number,"date": string,"impressions": number
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id": string,"campaign_name": string,"clicks"?: number,"cost_micros"?: number,"date": string,"impressions"?: number
                  }
                  Update: {
                    "campaign_id"?: string,"campaign_name"?: string,"clicks"?: number,"cost_micros"?: number,"date"?: string,"impressions"?: number
                  }
                  Relationships: [
                    
                  ]
                },"announcements": {
                  Row: {
                    "body": string,"ends_on": string | null,"id": string,"image_id": string | null,"published": boolean,"sort": number,"starts_on": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"ends_on"?: string | null,"id"?: string,"image_id"?: string | null,"published"?: boolean,"sort"?: number,"starts_on"?: string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "body"?: string,"ends_on"?: string | null,"id"?: string,"image_id"?: string | null,"published"?: boolean,"sort"?: number,"starts_on"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_image_id_fkey"
      columns: ["image_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
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
                },"content_revisions": {
                  Row: {
                    "created_at": string,"editor_id": string | null,"id": string,"key": string,"new_value": Json | null,"old_value": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"editor_id"?: string | null,"id"?: string,"key": string,"new_value"?: Json | null,"old_value"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"editor_id"?: string | null,"id"?: string,"key"?: string,"new_value"?: Json | null,"old_value"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_revisions_editor_id_fkey"
      columns: ["editor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversion_uploads": {
                  Row: {
                    "conversion_action": string,"conversion_at": string,"error": string | null,"gclid": string | null,"id": string,"lead_id": string,"status": string,"uploaded_at": string | null,"value": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "conversion_action": string,"conversion_at"?: string,"error"?: string | null,"gclid"?: string | null,"id"?: string,"lead_id": string,"status"?: string,"uploaded_at"?: string | null,"value"?: number | null
                  }
                  Update: {
                    "conversion_action"?: string,"conversion_at"?: string,"error"?: string | null,"gclid"?: string | null,"id"?: string,"lead_id"?: string,"status"?: string,"uploaded_at"?: string | null,"value"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversion_uploads_lead_id_fkey"
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
                },"feedback": {
                  Row: {
                    "admin_note": string | null,"body": string,"created_at": string,"created_by": string,"id": string,"kind": string,"page": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"body": string,"created_at"?: string,"created_by"?: string,"id"?: string,"kind": string,"page"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "admin_note"?: string | null,"body"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"kind"?: string,"page"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                    "ad_consent_revoked_at": string | null,"assigned_to": string | null,"beklemede_sezon": string | null,"channel": string | null,"child_birth_month": number | null,"child_birth_year": number | null,"child_name": string | null,"claimed_at": string | null,"consent_at": string | null,"contact_note": string | null,"content_code": string | null,"converted_student_id": string | null,"created_at": string,"district": string | null,"family_id": string | null,"first_contact_at": string | null,"gclid": string | null,"id": string,"ingilizce_gerekli": boolean,"is_qualified": boolean | null,"landing_path": string | null,"last_activity_at": string,"lost_reason": string | null,"ozel_durum": boolean,"ozel_durum_note": string | null,"parent_name": string,"phone": string,"q_age_ok": boolean | null,"q_area_ok": boolean | null,"q_reached": boolean | null,"q_timing_ok": boolean | null,"source": string,"source_detail": string | null,"start_window": string | null,"status": string,"updated_at": string,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"wants_summer": boolean,"wants_whatsapp": boolean | null,"web_payload": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ad_consent_revoked_at"?: string | null,"assigned_to"?: string | null,"beklemede_sezon"?: string | null,"channel"?: string | null,"child_birth_month"?: number | null,"child_birth_year"?: number | null,"child_name"?: string | null,"claimed_at"?: string | null,"consent_at"?: string | null,"contact_note"?: string | null,"content_code"?: string | null,"converted_student_id"?: string | null,"created_at"?: string,"district"?: string | null,"family_id"?: string | null,"first_contact_at"?: string | null,"gclid"?: string | null,"id"?: string,"ingilizce_gerekli"?: boolean,"is_qualified"?: never,"landing_path"?: string | null,"last_activity_at"?: string,"lost_reason"?: string | null,"ozel_durum"?: boolean,"ozel_durum_note"?: string | null,"parent_name": string,"phone": string,"q_age_ok"?: boolean | null,"q_area_ok"?: boolean | null,"q_reached"?: boolean | null,"q_timing_ok"?: boolean | null,"source": string,"source_detail"?: string | null,"start_window"?: string | null,"status"?: string,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"wants_summer"?: boolean,"wants_whatsapp"?: boolean | null,"web_payload"?: Json | null
                  }
                  Update: {
                    "ad_consent_revoked_at"?: string | null,"assigned_to"?: string | null,"beklemede_sezon"?: string | null,"channel"?: string | null,"child_birth_month"?: number | null,"child_birth_year"?: number | null,"child_name"?: string | null,"claimed_at"?: string | null,"consent_at"?: string | null,"contact_note"?: string | null,"content_code"?: string | null,"converted_student_id"?: string | null,"created_at"?: string,"district"?: string | null,"family_id"?: string | null,"first_contact_at"?: string | null,"gclid"?: string | null,"id"?: string,"ingilizce_gerekli"?: boolean,"is_qualified"?: never,"landing_path"?: string | null,"last_activity_at"?: string,"lost_reason"?: string | null,"ozel_durum"?: boolean,"ozel_durum_note"?: string | null,"parent_name"?: string,"phone"?: string,"q_age_ok"?: boolean | null,"q_area_ok"?: boolean | null,"q_reached"?: boolean | null,"q_timing_ok"?: boolean | null,"source"?: string,"source_detail"?: string | null,"start_window"?: string | null,"status"?: string,"updated_at"?: string,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"wants_summer"?: boolean,"wants_whatsapp"?: boolean | null,"web_payload"?: Json | null
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
      foreignKeyName: "leads_converted_student_id_fkey"
      columns: ["converted_student_id"]
isOneToOne: false
      referencedRelation: "v_overdue_installments"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "leads_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"media_assets": {
                  Row: {
                    "alt": string,"created_at": string,"faces": string,"height": number,"id": string,"s3_key": string,"uploaded_by": string | null,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alt": string,"created_at"?: string,"faces": string,"height": number,"id"?: string,"s3_key": string,"uploaded_by"?: string | null,"width": number
                  }
                  Update: {
                    "alt"?: string,"created_at"?: string,"faces"?: string,"height"?: number,"id"?: string,"s3_key"?: string,"uploaded_by"?: string | null,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_assets_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                    "created_at": string,"id": string,"installment_count": number,"item_type": string,"season": string,"source_offer_id": string | null,"student_id": string,"tentative_from": string | null,"total_amount": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"installment_count": number,"item_type": string,"season": string,"source_offer_id"?: string | null,"student_id": string,"tentative_from"?: string | null,"total_amount": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"installment_count"?: number,"item_type"?: string,"season"?: string,"source_offer_id"?: string | null,"student_id"?: string,"tentative_from"?: string | null,"total_amount"?: number,"updated_at"?: string
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
    },{
      foreignKeyName: "payment_plans_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_overdue_installments"
      referencedColumns: ["student_id"]
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
                    "can_edit_site": boolean,"created_at": string,"full_name": string,"id": string,"is_active": boolean,"role": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "can_edit_site"?: boolean,"created_at"?: string,"full_name": string,"id": string,"is_active"?: boolean,"role": string,"updated_at"?: string
                  }
                  Update: {
                    "can_edit_site"?: boolean,"created_at"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: string,"updated_at"?: string
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
    },{
      foreignKeyName: "refunds_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_overdue_installments"
      referencedColumns: ["student_id"]
    }
                  ]
                },"site_content": {
                  Row: {
                    "key": string,"kind": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"kind": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"kind"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_content_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"site_visit_daily": {
                  Row: {
                    "day": string,"device": string,"entrances": number,"pageviews": number,"path": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"device": string,"entrances"?: number,"pageviews"?: number,"path": string,"source": string
                  }
                  Update: {
                    "day"?: string,"device"?: string,"entrances"?: number,"pageviews"?: number,"path"?: string,"source"?: string
                  }
                  Relationships: [
                    
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
                    "assigned_to": string,"auto_generated": boolean,"created_at": string,"due_at": string | null,"due_date": string,"id": string,"lead_id": string | null,"rule_key": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to": string,"auto_generated"?: boolean,"created_at"?: string,"due_at"?: string | null,"due_date": string,"id"?: string,"lead_id"?: string | null,"rule_key"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string,"auto_generated"?: boolean,"created_at"?: string,"due_at"?: string | null,"due_date"?: string,"id"?: string,"lead_id"?: string | null,"rule_key"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
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
                },"wa_outbox": {
                  Row: {
                    "attempts": number,"available_at": string,"created_at": string,"error": string | null,"event_id": string | null,"id": string,"locked_at": string | null,"message": string | null,"note_id": string | null,"sent_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"available_at"?: string,"created_at"?: string,"error"?: string | null,"event_id"?: string | null,"id"?: string,"locked_at"?: string | null,"message"?: string | null,"note_id"?: string | null,"sent_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"available_at"?: string,"created_at"?: string,"error"?: string | null,"event_id"?: string | null,"id"?: string,"locked_at"?: string | null,"message"?: string | null,"note_id"?: string | null,"sent_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wa_outbox_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wa_outbox_note_id_fkey"
      columns: ["note_id"]
isOneToOne: true
      referencedRelation: "lead_notes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "active_announcements": {
                  Row: {
                    "body": string | null,"ends_on": string | null,"id": string | null,"image_id": string | null,"sort": number | null,"starts_on": string | null,"title": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "body"?: string | null,"ends_on"?: string | null,"id"?: string | null,"image_id"?: string | null,"sort"?: number | null,"starts_on"?: string | null,"title"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "body"?: string | null,"ends_on"?: string | null,"id"?: string | null,"image_id"?: string | null,"sort"?: number | null,"starts_on"?: string | null,"title"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "announcements_image_id_fkey"
      columns: ["image_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"v_overdue_installments": {
                  Row: {
                    "amount": number | null,"days_overdue": number | null,"due_date": string | null,"family_phone": string | null,"installment_id": string | null,"item_type": string | null,"season": string | null,"student_id": string | null,"student_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_counter_offer":
{ Args: { "source_offer_id": string }; Returns: string
                           },
"apply_plan_amounts":
{ Args: { "p_changes": Json,"p_clear_tentative": boolean,"p_plan_id": string }; Returns: undefined
                           },
"can_edit_site":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"create_web_lead":
{ Args: { "p_consent_at": string,"p_gclid": string,"p_landing_path": string,"p_meta"?: Json,"p_parent_name": string,"p_phone": string,"p_utm": Json }; Returns: Json
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_yonetici":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"record_site_visit":
{ Args: { "p_device": string,"p_entrance": boolean,"p_path": string,"p_source": string }; Returns: undefined
                           },
"reorder_announcements":
{ Args: { "p_dir": number,"p_id": string }; Returns: boolean
                           },
"save_site_content":
{ Args: { "p_edits": Json }; Returns: Json
                           },
"set_can_edit_site":
{ Args: { "p_user": string,"p_value": boolean }; Returns: undefined
                           },
"wa_bildirim_acik":
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
