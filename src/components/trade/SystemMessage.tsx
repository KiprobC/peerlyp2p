import { 
  Lock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Scale, 
  Clock, 
  CreditCard,
  Timer,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemMessageProps {
  message: string;
  className?: string;
}

// Determine message type and styling based on content
const getMessageConfig = (message: string) => {
  const lowerMessage = message.toLowerCase();
  
  // Escrow locked
  if (lowerMessage.includes('escrow locked') || lowerMessage.includes('🔒')) {
    return {
      icon: Lock,
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-500',
      textColor: 'text-blue-400'
    };
  }
  
  // Trade completed
  if (lowerMessage.includes('completed') || lowerMessage.includes('released') || lowerMessage.includes('✅')) {
    return {
      icon: CheckCircle,
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-500',
      textColor: 'text-green-400'
    };
  }
  
  // Trade cancelled
  if (lowerMessage.includes('cancelled') || lowerMessage.includes('❌')) {
    return {
      icon: XCircle,
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/30',
      iconColor: 'text-gray-500',
      textColor: 'text-gray-400'
    };
  }
  
  // Dispute raised
  if (lowerMessage.includes('dispute') && (lowerMessage.includes('raised') || lowerMessage.includes('⚠️'))) {
    return {
      icon: AlertTriangle,
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      iconColor: 'text-orange-500',
      textColor: 'text-orange-400'
    };
  }
  
  // Dispute resolved by admin
  if (lowerMessage.includes('resolved by admin') || lowerMessage.includes('⚖️')) {
    return {
      icon: Scale,
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-500',
      textColor: 'text-purple-400'
    };
  }
  
  // Payment sent
  if (lowerMessage.includes('payment') && (lowerMessage.includes('sent') || lowerMessage.includes('💸'))) {
    return {
      icon: CreditCard,
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-500',
      textColor: 'text-amber-400'
    };
  }
  
  // Timer/expired
  if (lowerMessage.includes('expired') || lowerMessage.includes('⏱️')) {
    return {
      icon: Timer,
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      iconColor: 'text-red-500',
      textColor: 'text-red-400'
    };
  }
  
  // Buying/Selling initial messages
  if (lowerMessage.includes('buying') || lowerMessage.includes('📥')) {
    return {
      icon: CheckCircle,
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/30',
      iconColor: 'text-primary',
      textColor: 'text-primary'
    };
  }
  
  if (lowerMessage.includes('selling') || lowerMessage.includes('📤')) {
    return {
      icon: CheckCircle,
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/30',
      iconColor: 'text-primary',
      textColor: 'text-primary'
    };
  }
  
  // Admin notes
  if (lowerMessage.includes('admin notes') || lowerMessage.includes('📝')) {
    return {
      icon: MessageSquare,
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/30',
      iconColor: 'text-violet-500',
      textColor: 'text-violet-400'
    };
  }
  
  // Default
  return {
    icon: Clock,
    bgColor: 'bg-secondary/50',
    borderColor: 'border-border/50',
    iconColor: 'text-muted-foreground',
    textColor: 'text-muted-foreground'
  };
};

export const SystemMessage = ({ message, className }: SystemMessageProps) => {
  const config = getMessageConfig(message);
  const Icon = config.icon;
  
  return (
    <div className={cn(
      "flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <Icon className={cn("w-4 h-4 shrink-0", config.iconColor)} />
      <p className={cn("text-xs text-center leading-relaxed", config.textColor)}>
        {message}
      </p>
    </div>
  );
};
