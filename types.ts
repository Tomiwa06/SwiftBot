
export enum ServiceType {
  AuditPreparation = "Audit Preparation",
  CFOSupport = "CFO Support Services",
  EntityFormation = "Legal Entity Formation",
  AccountingAdvisory = "Accounting Advisory Services",
  TaxAuditSpecialist = "Tax Audit Specialist Services",
  DirectIndirectTax = "Direct & Indirect Tax Advisory"
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  isThinking?: boolean;
  isToolCall?: boolean;
  toolResult?: BookingDetails | string[]; // Can now hold a list of time slots
}

export interface BookingDetails {
  name: string;
  email: string;
  service: string;
  datetime: string;
  confirmationCode: string;
  meetLink?: string | null;
}

export enum SendingState {
  Idle,
  Sending,
  ProcessingTool,
  Receiving
}
