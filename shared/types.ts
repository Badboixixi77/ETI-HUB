// Shared types used across client and server

export type Role = 'admin' | 'finance' | 'operations' | 'support' | 'developer';

export const ALL_ROLES: Role[] = ['admin', 'finance', 'operations', 'support', 'developer'];

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type KanbanColumn =
  | 'new_order'
  | 'kyc_review'
  | 'inspection'
  | 'shipment'
  | 'delivery'
  | 'completed';

export const KANBAN_COLUMNS: { key: KanbanColumn; label: string }[] = [
  { key: 'new_order', label: 'New Order' },
  { key: 'kyc_review', label: 'KYC Review' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'shipment', label: 'Shipment' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'completed', label: 'Completed' },
];

export type DocumentCategory = 'contract' | 'invoice' | 'compliance' | 'meeting_notes' | 'other';

export type EventCategory = 'deadline' | 'shipment' | 'inspection' | 'meeting' | 'other';

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  deadline: '#dc2626',
  shipment: '#0f2d5c',
  inspection: '#d97706',
  meeting: '#7c3aed',
  other: '#64748b',
};

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  title: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastActiveAt: string | null;
  createdAt: string;
}
