import { useState } from "react";
import { useAdminNotifications, useAdminUsers } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Bell, 
  Send, 
  Users, 
  Megaphone, 
  AlertTriangle, 
  Info, 
  CheckCircle2,
  Loader2,
  User
} from "lucide-react";

type NotificationType = "system" | "trade" | "payment" | "kyc" | "message";

const notificationTypes: { value: NotificationType; label: string; icon: typeof Bell }[] = [
  { value: "system", label: "System", icon: Info },
  { value: "trade", label: "Trade", icon: CheckCircle2 },
  { value: "payment", label: "Payment", icon: CheckCircle2 },
  { value: "kyc", label: "KYC", icon: AlertTriangle },
  { value: "message", label: "Message", icon: Bell },
];

export const AdminNotifications = () => {
  const { sendSystemNotification, sendBulkNotification } = useAdminNotifications();
  const { users, loading: usersLoading } = useAdminUsers();
  
  // Single user notification state
  const [singleUserId, setSingleUserId] = useState("");
  const [singleTitle, setSingleTitle] = useState("");
  const [singleMessage, setSingleMessage] = useState("");
  const [singleType, setSingleType] = useState<NotificationType>("system");
  const [sendingSingle, setSendingSingle] = useState(false);

  // Bulk notification state
  const [bulkTitle, setBulkTitle] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkType, setBulkType] = useState<NotificationType>("system");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [userFilter, setUserFilter] = useState("");

  // Announcement state
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(userFilter.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(userFilter.toLowerCase())
  );

  const handleSendSingleNotification = async () => {
    if (!singleUserId || !singleTitle || !singleMessage) {
      toast.error("Please fill in all fields");
      return;
    }

    setSendingSingle(true);
    try {
      await sendSystemNotification(singleUserId, singleTitle, singleMessage, singleType);
      toast.success("Notification sent successfully");
      setSingleTitle("");
      setSingleMessage("");
      setSingleUserId("");
    } catch (error) {
      toast.error("Failed to send notification");
    } finally {
      setSendingSingle(false);
    }
  };

  const handleSendBulkNotification = async () => {
    if (selectedUsers.length === 0 || !bulkTitle || !bulkMessage) {
      toast.error("Please select users and fill in all fields");
      return;
    }

    setSendingBulk(true);
    try {
      await sendBulkNotification(selectedUsers, bulkTitle, bulkMessage, bulkType);
      toast.success(`Notifications sent to ${selectedUsers.length} users`);
      setBulkTitle("");
      setBulkMessage("");
      setSelectedUsers([]);
      setSelectAll(false);
    } catch (error) {
      toast.error("Failed to send notifications");
    } finally {
      setSendingBulk(false);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announcementTitle || !announcementMessage) {
      toast.error("Please fill in all fields");
      return;
    }

    setSendingAnnouncement(true);
    try {
      const allUserIds = users.map(u => u.user_id);
      await sendBulkNotification(allUserIds, announcementTitle, announcementMessage, "system");
      toast.success(`Announcement sent to all ${users.length} users`);
      setAnnouncementTitle("");
      setAnnouncementMessage("");
    } catch (error) {
      toast.error("Failed to send announcement");
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedUsers(filteredUsers.map(u => u.user_id));
    } else {
      setSelectedUsers([]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">Send system notifications and announcements to users</p>
      </div>

      <Tabs defaultValue="single" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Single User
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Bulk
          </TabsTrigger>
          <TabsTrigger value="announcement" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Announcement
          </TabsTrigger>
        </TabsList>

        {/* Single User Notification */}
        <TabsContent value="single">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Send to Individual User
              </CardTitle>
              <CardDescription>
                Send a notification to a specific user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select value={singleUserId} onValueChange={setSingleUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name || user.email} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notification Type</Label>
                <Select value={singleType} onValueChange={(v) => setSingleType(v as NotificationType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input 
                  placeholder="Notification title..."
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea 
                  placeholder="Enter your message..."
                  value={singleMessage}
                  onChange={(e) => setSingleMessage(e.target.value)}
                  rows={4}
                />
              </div>

              <Button 
                onClick={handleSendSingleNotification}
                disabled={sendingSingle || !singleUserId || !singleTitle || !singleMessage}
                className="w-full"
              >
                {sendingSingle ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Notification
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Notification */}
        <TabsContent value="bulk">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Select Recipients
                </CardTitle>
                <CardDescription>
                  Choose users to receive this notification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Filter users..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                />
                
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Checkbox 
                    id="selectAll"
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="selectAll" className="cursor-pointer">
                    Select all ({filteredUsers.length} users)
                  </Label>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No users found</p>
                  ) : (
                    filteredUsers.map(user => (
                      <div 
                        key={user.user_id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <Checkbox
                          id={user.user_id}
                          checked={selectedUsers.includes(user.user_id)}
                          onCheckedChange={() => toggleUserSelection(user.user_id)}
                        />
                        <Label htmlFor={user.user_id} className="flex-1 cursor-pointer">
                          <div className="font-medium">{user.full_name || "No name"}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </Label>
                        <Badge variant={user.kyc_status === "verified" ? "default" : "secondary"}>
                          {user.kyc_status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>

                {selectedUsers.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <Badge variant="outline">
                      {selectedUsers.length} user(s) selected
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Compose Message</CardTitle>
                <CardDescription>
                  Create the notification to send
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Notification Type</Label>
                  <Select value={bulkType} onValueChange={(v) => setBulkType(v as NotificationType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {notificationTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input 
                    placeholder="Notification title..."
                    value={bulkTitle}
                    onChange={(e) => setBulkTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea 
                    placeholder="Enter your message..."
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    rows={6}
                  />
                </div>

                <Button 
                  onClick={handleSendBulkNotification}
                  disabled={sendingBulk || selectedUsers.length === 0 || !bulkTitle || !bulkMessage}
                  className="w-full"
                >
                  {sendingBulk ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send to {selectedUsers.length} User(s)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Announcement */}
        <TabsContent value="announcement">
          <Card className="glass-card max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                System-Wide Announcement
              </CardTitle>
              <CardDescription>
                Send a notification to all {users.length} users on the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Warning</p>
                    <p className="text-sm text-muted-foreground">
                      This will send a notification to ALL users. Use this feature responsibly for important announcements only.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Announcement Title</Label>
                <Input 
                  placeholder="e.g., Important System Update"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Announcement Message</Label>
                <Textarea 
                  placeholder="Enter your announcement message..."
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  rows={6}
                />
              </div>

              <Button 
                onClick={handleSendAnnouncement}
                disabled={sendingAnnouncement || !announcementTitle || !announcementMessage}
                variant="destructive"
                className="w-full"
              >
                {sendingAnnouncement ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Megaphone className="h-4 w-4 mr-2" />
                )}
                Send to All {users.length} Users
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminNotifications;
