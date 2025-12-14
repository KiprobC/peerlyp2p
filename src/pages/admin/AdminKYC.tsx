import { useState } from "react";
import { Shield, ShieldCheck, ShieldX, Clock, Eye, X } from "lucide-react";
import { useAdminUsers, AdminUser } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/admin/DataTable";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const kycStatusConfig = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" as const },
  submitted: { label: "Submitted", icon: Shield, variant: "outline" as const },
  verified: { label: "Verified", icon: ShieldCheck, variant: "default" as const },
  rejected: { label: "Rejected", icon: ShieldX, variant: "destructive" as const },
};

interface KYCDocument {
  type: string;
  url: string | null;
}

export const AdminKYC = () => {
  const { users, loading, updateUserKYC, refetch } = useAdminUsers();
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Filter users who have submitted KYC
  const kycSubmissions = users.filter((u) => u.kyc_status !== "pending");

  const viewUserKYC = async (user: AdminUser) => {
    setSelectedUser(user);
    setLoadingDocs(true);
    
    try {
      // Fetch full profile with document URLs
      const { data: profile } = await supabase
        .from("profiles")
        .select("id_front_url, id_back_url, selfie_url")
        .eq("user_id", user.user_id)
        .single();

      if (profile) {
        const docs: KYCDocument[] = [];
        
        if (profile.id_front_url) {
          const { data } = await supabase.storage
            .from("kyc-documents")
            .createSignedUrl(profile.id_front_url, 3600);
          docs.push({ type: "ID Front", url: data?.signedUrl || null });
        }
        
        if (profile.id_back_url) {
          const { data } = await supabase.storage
            .from("kyc-documents")
            .createSignedUrl(profile.id_back_url, 3600);
          docs.push({ type: "ID Back", url: data?.signedUrl || null });
        }
        
        if (profile.selfie_url) {
          const { data } = await supabase.storage
            .from("kyc-documents")
            .createSignedUrl(profile.selfie_url, 3600);
          docs.push({ type: "Selfie with ID", url: data?.signedUrl || null });
        }
        
        setDocuments(docs);
      }
    } catch (error) {
      console.error("Error fetching KYC documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedUser) return;
    setProcessing(true);
    
    const { error } = await updateUserKYC(selectedUser.user_id, "verified");
    
    setProcessing(false);
    if (error) {
      toast.error("Failed to approve KYC");
    } else {
      toast.success("KYC approved successfully");
      setSelectedUser(null);
      refetch();
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;
    setProcessing(true);
    
    const { error } = await updateUserKYC(selectedUser.user_id, "rejected");
    
    // Also create a notification with the rejection reason
    if (!error && rejectReason.trim()) {
      await supabase.from("notifications").insert({
        user_id: selectedUser.user_id,
        type: "kyc",
        title: "KYC Rejected",
        message: `Your verification was rejected: ${rejectReason}`,
      });
    }
    
    setProcessing(false);
    if (error) {
      toast.error("Failed to reject KYC");
    } else {
      toast.success("KYC rejected");
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedUser(null);
      refetch();
    }
  };

  const columns = [
    {
      key: "full_name",
      header: "User",
      render: (user: AdminUser) => (
        <div>
          <p className="font-medium">{user.full_name || "No name"}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    {
      key: "kyc_status",
      header: "Status",
      render: (user: AdminUser) => {
        const config = kycStatusConfig[user.kyc_status];
        return (
          <Badge variant={config.variant} className="gap-1">
            <config.icon className="h-3 w-3" />
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: "created_at",
      header: "Submitted",
      render: (user: AdminUser) => (
        <span className="text-muted-foreground text-sm">
          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      render: (user: AdminUser) => (
        <Button variant="outline" size="sm" onClick={() => viewUserKYC(user)}>
          <Eye className="h-4 w-4 mr-1" />
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">KYC Verification</h1>
        <p className="text-muted-foreground">Review and manage identity verification submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card text-center">
          <p className="text-2xl font-bold">{users.filter((u) => u.kyc_status === "submitted").length}</p>
          <p className="text-sm text-muted-foreground">Pending Review</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-2xl font-bold text-primary">{users.filter((u) => u.kyc_status === "verified").length}</p>
          <p className="text-sm text-muted-foreground">Verified</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-2xl font-bold text-destructive">{users.filter((u) => u.kyc_status === "rejected").length}</p>
          <p className="text-sm text-muted-foreground">Rejected</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-2xl font-bold text-muted-foreground">{users.filter((u) => u.kyc_status === "pending").length}</p>
          <p className="text-sm text-muted-foreground">Not Submitted</p>
        </div>
      </div>

      <DataTable
        data={kycSubmissions}
        columns={columns}
        searchPlaceholder="Search users..."
        loading={loading}
        emptyMessage="No KYC submissions found"
      />

      {/* KYC Review Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KYC Review - {selectedUser?.full_name || "User"}</DialogTitle>
            <DialogDescription>
              Review the submitted documents and approve or reject verification
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* User Info */}
            <div className="glass-card">
              <h3 className="font-semibold mb-3">User Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <span className="ml-2 font-medium">{selectedUser?.full_name || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <span className="ml-2 font-medium">{selectedUser?.email || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="ml-2 font-medium">{selectedUser?.phone || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Country:</span>
                  <span className="ml-2 font-medium">{selectedUser?.country || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div>
              <h3 className="font-semibold mb-3">Submitted Documents</h3>
              {loadingDocs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : documents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No documents uploaded</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {documents.map((doc, index) => (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <p className="font-medium text-sm mb-2">{doc.type}</p>
                      {doc.url ? (
                        <img
                          src={doc.url}
                          alt={doc.type}
                          className="w-full h-48 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setPreviewImage(doc.url)}
                        />
                      ) : (
                        <div className="w-full h-48 bg-secondary/50 rounded flex items-center justify-center text-muted-foreground">
                          Not available
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current Status */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current Status:</span>
              {selectedUser && (
                <Badge variant={kycStatusConfig[selectedUser.kyc_status].variant}>
                  {kycStatusConfig[selectedUser.kyc_status].label}
                </Badge>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Close
            </Button>
            {selectedUser?.kyc_status !== "verified" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={processing}
                >
                  <ShieldX className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button onClick={handleApprove} disabled={processing}>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {processing ? "Processing..." : "Approve"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejection Reason</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this KYC submission
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? "Processing..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-4 h-4" />
          </Button>
          {previewImage && (
            <img src={previewImage} alt="Document preview" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminKYC;
