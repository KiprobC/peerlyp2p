import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowRight, ArrowLeft, Users, Shield, Clock, Star, UserCheck, Info } from "lucide-react";
import { StepProps } from "../types";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const KYC_OPTIONS = [
  { value: "none", label: "No KYC Required", description: "Anyone can trade", icon: Users },
  { value: "basic", label: "Basic Verification", description: "Email & phone verified", icon: UserCheck },
  { value: "full", label: "Full KYC", description: "ID verified traders only", icon: Shield },
];

export const Step6TradeControls = ({ formData, updateFormData, onNext, onBack }: StepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Trade Controls</h2>
        <p className="text-muted-foreground">
          Set limits and requirements to protect your trades
        </p>
      </div>

      {/* Max Trades Per User */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <Label className="text-sm font-medium">Max Trades Per User</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Limit how many times the same user can trade on this offer
        </p>
        <Input
          type="number"
          placeholder="Leave empty for unlimited"
          value={formData.max_trades_per_user}
          onChange={(e) => updateFormData({ max_trades_per_user: e.target.value })}
          className="h-11"
          min="1"
        />
      </div>

      {/* KYC Requirements */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">KYC Requirements</Label>
        <div className="space-y-2">
          {KYC_OPTIONS.map((option) => {
            const isSelected = formData.kyc_required === option.value;
            const Icon = option.icon;
            
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateFormData({ kyc_required: option.value as "none" | "basic" | "full" })}
                className={cn(
                  "w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 text-left",
                  "hover:scale-[1.01] active:scale-[0.99]",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-muted-foreground/30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary/20" : "bg-secondary"
                )}>
                  <Icon className={cn("w-5 h-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 shrink-0",
                  isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                )}>
                  {isSelected && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle Options */}
      <div className="space-y-4">
        {/* Allow New Users */}
        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Allow New Users</p>
              <p className="text-sm text-muted-foreground">Let first-time traders use your offer</p>
            </div>
          </div>
          <Switch
            checked={formData.allow_new_users}
            onCheckedChange={(checked) => updateFormData({ allow_new_users: checked })}
          />
        </div>

        {/* Trusted Traders Only */}
        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="font-medium">Trusted Traders Only</p>
              <p className="text-sm text-muted-foreground">Require positive trade history</p>
            </div>
          </div>
          <Switch
            checked={formData.trusted_only}
            onCheckedChange={(checked) => updateFormData({ trusted_only: checked })}
          />
        </div>
      </div>

      {/* Auto-Cancel Timer */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <Label className="text-sm font-medium">Auto-Cancel Timer</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Automatically cancel trade if buyer doesn't mark payment
        </p>
        <Select
          value={formData.auto_cancel_minutes}
          onValueChange={(value) => updateFormData({ auto_cancel_minutes: value })}
        >
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="45">45 minutes</SelectItem>
            <SelectItem value="60">60 minutes</SelectItem>
            <SelectItem value="90">90 minutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
        <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>Stricter requirements may reduce trade volume but increase security. We recommend enabling KYC for high-value trades.</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} className="flex-1 h-12">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
