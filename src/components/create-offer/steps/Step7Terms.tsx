import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, FileText, MessageSquare, Eye, Lightbulb } from "lucide-react";
import { StepProps } from "../types";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TERMS_TIPS = [
  "Be clear about your availability and response times",
  "Specify any account requirements (e.g., verified PayPal only)",
  "Mention if you need specific payment references",
  "State your cancellation policy",
];

const INSTRUCTIONS_TIPS = [
  "Include your payment details (e.g., bank account, phone number)",
  "Explain the exact steps the buyer should follow",
  "Mention what to include in the payment reference",
  "Specify what proof you need (receipt, screenshot)",
];

export const Step7Terms = ({ formData, updateFormData, onNext, onBack }: StepProps) => {
  const [showPreview, setShowPreview] = useState(false);
  
  const termsLength = formData.terms.length;
  const instructionsLength = formData.payment_instructions.length;
  const maxLength = 1000;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Terms & Instructions</h2>
        <p className="text-muted-foreground">
          Provide clear instructions for traders using your offer
        </p>
      </div>

      {/* Preview Toggle */}
      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          variant={!showPreview ? "default" : "outline"}
          size="sm"
          onClick={() => setShowPreview(false)}
        >
          <FileText className="w-4 h-4 mr-1" />
          Edit
        </Button>
        <Button
          type="button"
          variant={showPreview ? "default" : "outline"}
          size="sm"
          onClick={() => setShowPreview(true)}
        >
          <Eye className="w-4 h-4 mr-1" />
          Preview
        </Button>
      </div>

      {showPreview ? (
        /* Preview Mode */
        <div className="space-y-4">
          <div className="p-4 bg-card border rounded-xl space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Seller Terms</p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {formData.terms ? (
                  <p className="whitespace-pre-wrap">{formData.terms}</p>
                ) : (
                  <p className="text-muted-foreground italic">No terms specified</p>
                )}
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Payment Instructions</p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {formData.payment_instructions ? (
                  <p className="whitespace-pre-wrap">{formData.payment_instructions}</p>
                ) : (
                  <p className="text-muted-foreground italic">No payment instructions specified</p>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            This is exactly how traders will see your offer
          </p>
        </div>
      ) : (
        /* Edit Mode */
        <div className="space-y-6">
          {/* Terms */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">Offer Terms</Label>
              </div>
              <span className={cn(
                "text-xs",
                termsLength > maxLength * 0.9 ? "text-yellow-500" : "text-muted-foreground"
              )}>
                {termsLength}/{maxLength}
              </span>
            </div>
            <Textarea
              placeholder="Describe your terms and requirements for this offer..."
              value={formData.terms}
              onChange={(e) => updateFormData({ terms: e.target.value.slice(0, maxLength) })}
              rows={5}
              className="resize-none"
            />
            
            {/* Tips */}
            <div className="p-3 bg-primary/5 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Lightbulb className="w-4 h-4" />
                <span className="text-xs font-medium">Tips for great terms</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {TERMS_TIPS.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Payment Instructions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">Payment Instructions</Label>
              </div>
              <span className={cn(
                "text-xs",
                instructionsLength > maxLength * 0.9 ? "text-yellow-500" : "text-muted-foreground"
              )}>
                {instructionsLength}/{maxLength}
              </span>
            </div>
            <Textarea
              placeholder="Provide step-by-step payment instructions..."
              value={formData.payment_instructions}
              onChange={(e) => updateFormData({ payment_instructions: e.target.value.slice(0, maxLength) })}
              rows={5}
              className="resize-none"
            />
            
            {/* Tips */}
            <div className="p-3 bg-primary/5 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Lightbulb className="w-4 h-4" />
                <span className="text-xs font-medium">Tips for clear instructions</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {INSTRUCTIONS_TIPS.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
