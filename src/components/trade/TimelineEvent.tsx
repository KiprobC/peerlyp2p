import { 
  Lock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Scale, 
  CreditCard,
  Timer,
  MessageSquare,
  ArrowDownCircle,
  ArrowUpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineEventProps {
  message: string;
  className?: string;
}

// Determine event type and styling based on content
const getEventConfig = (message: string) => {
  const lowerMessage = message.toLowerCase();
  
  // Escrow locked
  if (lowerMessage.includes('escrow locked') || lowerMessage.includes('🔒')) {
    return {
      icon: Lock,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    };
  }
  
  // Trade completed / released
  if (lowerMessage.includes('completed') || lowerMessage.includes('released') || lowerMessage.includes('✅')) {
    return {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    };
  }
  
  // Trade cancelled
  if (lowerMessage.includes('cancelled') || lowerMessage.includes('❌')) {
    return {
      icon: XCircle,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    };
  }
  
  // Dispute raised
  if (lowerMessage.includes('dispute') && (lowerMessage.includes('raised') || lowerMessage.includes('⚠️'))) {
    return {
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    };
  }
  
  // Dispute resolved by admin
  if (lowerMessage.includes('resolved by admin') || lowerMessage.includes('⚖️')) {
    return {
      icon: Scale,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    };
  }
  
  // Payment sent
  if (lowerMessage.includes('payment') && (lowerMessage.includes('sent') || lowerMessage.includes('💸'))) {
    return {
      icon: CreditCard,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    };
  }
  
  // Timer/expired
  if (lowerMessage.includes('expired') || lowerMessage.includes('⏱️')) {
    return {
      icon: Timer,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    };
  }
  
  // Buying
  if (lowerMessage.includes('buying') || lowerMessage.includes('📥')) {
    return {
      icon: ArrowDownCircle,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    };
  }
  
  // Selling
  if (lowerMessage.includes('selling') || lowerMessage.includes('📤')) {
    return {
      icon: ArrowUpCircle,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    };
  }
  
  // Admin notes
  if (lowerMessage.includes('admin notes') || lowerMessage.includes('📝')) {
    return {
      icon: MessageSquare,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
    };
  }
  
  // Default
  return {
    icon: CheckCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  };
};

export const TimelineEvent = ({ message, className }: TimelineEventProps) => {
  const config = getEventConfig(message);
  const Icon = config.icon;
  
  return (
    <div className={cn("flex items-center justify-center py-2", className)}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50">
        <div className={cn("w-4 h-4 rounded-full flex items-center justify-center", config.bgColor)}>
          <Icon className={cn("w-2.5 h-2.5", config.color)} />
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">
          {message}
        </span>
      </div>
    </div>
  );
};
