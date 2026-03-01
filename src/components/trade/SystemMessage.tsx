import { 
  Lock, CheckCircle, XCircle, AlertTriangle, Scale, Clock, CreditCard, Timer, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemMessageProps {
  message: string;
  className?: string;
}

const getMessageConfig = (message: string) => {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('escrow locked') || lowerMessage.includes('🔒')) {
    return { icon: Lock, color: 'text-blue-500' };
  }
  if (lowerMessage.includes('completed') || lowerMessage.includes('released') || lowerMessage.includes('✅')) {
    return { icon: CheckCircle, color: 'text-green-500' };
  }
  if (lowerMessage.includes('cancelled') || lowerMessage.includes('❌')) {
    return { icon: XCircle, color: 'text-muted-foreground' };
  }
  if (lowerMessage.includes('dispute') && (lowerMessage.includes('raised') || lowerMessage.includes('⚠️'))) {
    return { icon: AlertTriangle, color: 'text-orange-500' };
  }
  if (lowerMessage.includes('resolved by admin') || lowerMessage.includes('⚖️')) {
    return { icon: Scale, color: 'text-purple-500' };
  }
  if (lowerMessage.includes('payment') && (lowerMessage.includes('sent') || lowerMessage.includes('💸'))) {
    return { icon: CreditCard, color: 'text-amber-500' };
  }
  if (lowerMessage.includes('expired') || lowerMessage.includes('⏱️')) {
    return { icon: Timer, color: 'text-destructive' };
  }
  if (lowerMessage.includes('buying') || lowerMessage.includes('📥') || lowerMessage.includes('selling') || lowerMessage.includes('📤')) {
    return { icon: CheckCircle, color: 'text-primary' };
  }
  if (lowerMessage.includes('admin notes') || lowerMessage.includes('📝')) {
    return { icon: MessageSquare, color: 'text-violet-500' };
  }
  return { icon: Clock, color: 'text-muted-foreground' };
};

export const SystemMessage = ({ message, className }: SystemMessageProps) => {
  const config = getMessageConfig(message);
  const Icon = config.icon;
  
  return (
    <div className={cn(
      "flex items-center justify-center gap-1.5 py-1.5 px-3",
      className
    )}>
      <div className="flex items-center gap-1.5 bg-secondary/60 dark:bg-secondary/40 rounded-full px-3 py-1 text-[11px] text-muted-foreground">
        <Icon className={cn("w-3 h-3 shrink-0", config.color)} />
        <span className="text-center leading-snug">{message}</span>
      </div>
    </div>
  );
};
