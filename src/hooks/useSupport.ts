import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assigned_to: string | null;
  user_email?: string;
  user_name?: string;
  unread_count?: number;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  read_at: string | null;
  created_at: string;
  sender_name?: string;
}

export const useSupport = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
    } catch (error) {
      console.error("Error fetching support tickets:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = async (subject: string, message: string) => {
    if (!user) return null;

    try {
      // Create ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, subject })
        .select()
        .single();

      if (ticketError) throw ticketError;
      const ticket = ticketData as SupportTicket;

      // Add first message
      const { error: messageError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: user.id,
          message,
          is_admin: false,
        });

      if (messageError) throw messageError;

      await fetchTickets();
      return ticket;
    } catch (error) {
      console.error("Error creating support ticket:", error);
      return null;
    }
  };

  return { tickets, loading, createTicket, refetch: fetchTickets };
};

export const useSupportMessages = (ticketId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!ticketId) return;

    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchMessages();

    // Subscribe to real-time updates
    if (ticketId) {
      const channel = supabase
        .channel(`support_messages_${ticketId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "support_messages",
            filter: `ticket_id=eq.${ticketId}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as SupportMessage]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [ticketId, fetchMessages]);

  const sendMessage = async (message: string, isAdmin = false) => {
    if (!user || !ticketId) return false;

    try {
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: ticketId,
        sender_id: user.id,
        message,
        is_admin: isAdmin,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  };

  return { messages, loading, sendMessage, refetch: fetchMessages };
};

export const useAdminSupport = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllTickets = useCallback(async () => {
    try {
      // First get all tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("support_tickets")
        .select("*")
        .order("updated_at", { ascending: false });

      if (ticketsError) throw ticketsError;

      // Fetch user profiles for each ticket
      const userIds = [...new Set((ticketsData || []).map((t) => t.user_id))];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, email")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      const ticketsWithUsers = (ticketsData || []).map((ticket) => {
        const profile = profileMap.get(ticket.user_id);
        return {
          ...ticket,
          status: ticket.status as SupportTicket["status"],
          priority: ticket.priority as SupportTicket["priority"],
          user_name: profile?.username || "Unknown",
          user_email: profile?.email || "",
        };
      });

      setTickets(ticketsWithUsers);
    } catch (error) {
      console.error("Error fetching admin tickets:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllTickets();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("admin_support_tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
        },
        () => {
          fetchAllTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllTickets]);

  const updateTicketStatus = async (
    ticketId: string,
    status: SupportTicket["status"]
  ) => {
    try {
      const updates: Record<string, unknown> = { status };
      if (status === "resolved" || status === "closed") {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketId);

      if (error) throw error;
      await fetchAllTickets();
      return true;
    } catch (error) {
      console.error("Error updating ticket status:", error);
      return false;
    }
  };

  return { tickets, loading, updateTicketStatus, refetch: fetchAllTickets };
};
