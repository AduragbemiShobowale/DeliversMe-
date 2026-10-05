// Generated to match the Phase 2 schema verified against a real Postgres
// instance (see supabase/functional_test.sql and its results). On a real
// Supabase project, regenerate this file with:
//   supabase gen types typescript --project-id <id> > src/types/database.ts
// Hand-maintained here only because no live project exists yet -- once
// one does, this file should be replaced by the CLI's actual output, not
// hand-edited further.

export type UserRole = "admin" | "owner" | "rider" | "customer";
export type BusinessVerificationStatus = "pending" | "verified" | "suspended";
export type RiderAvailability = "available" | "busy" | "offline";
export type BusinessCustomerStatus = "pending_invitation" | "active";
export type DeliveryPriority = "normal" | "urgent";
export type DeliveryStatus =
  | "ready_for_dispatch"
  | "assigned"
  | "accepted"
  | "in_transit"
  | "delivered"
  | "failed";
export type DeliveryEventType =
  | "created"
  | "priority_updated"
  | "assigned"
  | "accepted"
  | "rejected"
  | "expired"
  | "started"
  | "reassignment_requested"
  | "reassignment_denied"
  | "reassigned"
  | "location_updated"
  | "proof_uploaded"
  | "proof_corrected"
  | "delivered"
  | "failed"
  | "rating_recorded"
  | "admin_intervened";
export type EventActorRole = "owner" | "rider" | "admin" | "system";
export type ReassignmentStatus = "pending" | "approved" | "denied";
export type ResolverRole = "owner" | "admin";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          business_id: string | null;
          full_name: string;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          business_id?: string | null;
          full_name: string;
          phone?: string | null;
        };
        Update: {
          full_name?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          owner_profile_id: string;
          name: string;
          verification_status: BusinessVerificationStatus;
          assignment_timeout_minutes: number;
          rider_default_capacity: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_profile_id: string;
          name: string;
        };
        Update: {
          name?: string;
          assignment_timeout_minutes?: number;
          rider_default_capacity?: number | null;
          verification_status?: BusinessVerificationStatus;
        };
        Relationships: [];
      };
      riders: {
        Row: {
          profile_id: string;
          business_id: string;
          availability_status: RiderAvailability;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          business_id: string;
          availability_status?: RiderAvailability;
        };
        Update: {
          availability_status?: RiderAvailability;
        };
        Relationships: [];
      };
      business_customers: {
        Row: {
          id: string;
          business_id: string;
          customer_profile_id: string | null;
          status: BusinessCustomerStatus;
          pending_name: string | null;
          pending_phone: string | null;
          pending_email: string | null;
          default_address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      deliveries: {
        Row: {
          id: string;
          business_id: string;
          business_customer_id: string;
          assigned_rider_id: string | null;
          status: DeliveryStatus;
          priority: DeliveryPriority;
          scheduled_window_start: string | null;
          scheduled_window_end: string | null;
          estimated_delivery_minutes: number | null;
          assigned_at: string | null;
          accepted_at: string | null;
          started_at: string | null;
          delivered_at: string | null;
          failed_at: string | null;
          failure_reason: string | null;
          reassignment_requested: boolean;
          rating: number | null;
          rating_comment: string | null;
          rating_recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          business_customer_id: string;
          priority?: DeliveryPriority;
          scheduled_window_start?: string | null;
          scheduled_window_end?: string | null;
          estimated_delivery_minutes?: number | null;
        };
        Update: {
          priority?: DeliveryPriority;
          scheduled_window_start?: string | null;
          scheduled_window_end?: string | null;
          estimated_delivery_minutes?: number | null;
          rating?: number | null;
          rating_comment?: string | null;
          rating_recorded_by?: string | null;
        };
        Relationships: [];
      };
      delivery_events: {
        Row: {
          id: string;
          delivery_id: string;
          event_type: DeliveryEventType;
          actor_profile_id: string | null;
          actor_role: EventActorRole;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      delivery_locations: {
        Row: {
          id: string;
          delivery_id: string;
          rider_id: string;
          lat: number;
          lng: number;
          recorded_at: string;
        };
        Insert: {
          delivery_id: string;
          rider_id: string;
          lat: number;
          lng: number;
        };
        Update: never;
        Relationships: [];
      };
      reassignment_requests: {
        Row: {
          id: string;
          delivery_id: string;
          requested_by_rider_id: string;
          reason: string;
          evidence_photo_url: string | null;
          status: ReassignmentStatus;
          decided_by_role: ResolverRole | null;
          decided_by_profile_id: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          delivery_id: string;
          requested_by_rider_id: string;
          reason: string;
          evidence_photo_url?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      proof_of_delivery: {
        Row: {
          id: string;
          delivery_id: string;
          version: number;
          photo_url: string;
          recipient_name: string | null;
          notes: string | null;
          uploaded_by: string;
          uploaded_at: string;
        };
        Insert: {
          delivery_id: string;
          version: number;
          photo_url: string;
          recipient_name?: string | null;
          notes?: string | null;
          uploaded_by: string;
        };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          business_id: string;
          recipient_profile_id: string;
          delivery_id: string | null;
          source_event_id: string | null;
          notification_type: DeliveryEventType;
          title: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: never;
        Update: {
          is_read?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      find_or_create_business_customer: {
        Args: { p_phone: string | null; p_email: string | null; p_name: string; p_default_address?: string | null };
        Returns: string;
      };
      claim_business_customer: {
        Args: { p_business_customer_id: string };
        Returns: void;
      };
      claim_pending_relationships_by_phone: {
        Args: Record<string, never>;
        Returns: number;
      };
      create_delivery: {
        Args: {
          p_business_customer_id: string;
          p_priority?: DeliveryPriority;
          p_scheduled_window_start?: string | null;
          p_scheduled_window_end?: string | null;
          p_estimated_delivery_minutes?: number | null;
        };
        Returns: string;
      };
      assign_rider: { Args: { p_delivery_id: string; p_rider_id: string }; Returns: void };
      accept_delivery_assignment: { Args: { p_delivery_id: string }; Returns: void };
      reject_delivery_assignment: { Args: { p_delivery_id: string }; Returns: void };
      start_delivery: { Args: { p_delivery_id: string }; Returns: void };
      complete_delivery: {
        Args: { p_delivery_id: string; p_photo_url: string; p_recipient_name?: string | null; p_notes?: string | null };
        Returns: void;
      };
      fail_delivery: { Args: { p_delivery_id: string; p_reason: string }; Returns: void };
      request_reassignment: {
        Args: { p_delivery_id: string; p_reason: string; p_evidence_photo_url?: string | null };
        Returns: string;
      };
      resolve_reassignment: { Args: { p_request_id: string; p_decision: ReassignmentStatus }; Returns: void };
      submit_replacement_pod: {
        Args: { p_delivery_id: string; p_photo_url: string; p_recipient_name?: string | null; p_notes?: string | null };
        Returns: string;
      };
      admin_assign_rider: { Args: { p_delivery_id: string; p_rider_id: string; p_reason: string }; Returns: void };
      admin_resolve_reassignment: {
        Args: { p_request_id: string; p_decision: ReassignmentStatus; p_reason: string };
        Returns: void;
      };
      admin_view_reassignment_request: {
        Args: { p_request_id: string };
        Returns: {
          request_id: string;
          delivery_id: string;
          reason: string;
          evidence_photo_url: string | null;
          status: ReassignmentStatus;
          requested_by_rider_id: string;
          business_name: string;
        }[];
      };
      admin_set_business_verification: {
        Args: { p_business_id: string; p_status: BusinessVerificationStatus };
        Returns: void;
      };
    };
    Enums: {
      user_role: UserRole;
      business_verification_status: BusinessVerificationStatus;
      rider_availability: RiderAvailability;
      business_customer_status: BusinessCustomerStatus;
      delivery_priority: DeliveryPriority;
      delivery_status: DeliveryStatus;
      delivery_event_type: DeliveryEventType;
      event_actor_role: EventActorRole;
      reassignment_status: ReassignmentStatus;
      resolver_role: ResolverRole;
    };
  };
};
