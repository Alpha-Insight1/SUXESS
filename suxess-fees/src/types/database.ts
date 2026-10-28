// Loose types to avoid Supabase relation typing issues during build

export type Campus = {
  id: string;
  name: string;
  short_name?: string | null;
  address?: string | null;
  phone?: string | null;
  is_active?: boolean;
  created_at?: string;
};

export type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  class_name: string;
  campus_id?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  exam_preparing_for?: string | null;
  status?: "active" | "inactive" | string;
  created_at?: string;
  campuses?: Campus | Campus[] | null;
};

export type FeeType = {
  id: string;
  name: string;
  description?: string | null;
};

export type StudentFee = {
  id: string;
  student_id?: string;
  fee_type_id?: string;
  session?: string;
  term?: string;
  amount?: number;
  amount_paid?: number;
  balance?: number;
  due_date?: string | null;
  status?: string;
  created_at?: string;
  fee_types?: FeeType | null;
  students?: Student | null;
};

export type Payment = {
  id: string;
  student_id?: string;
  student_fee_id?: string | null;
  amount?: number;
  payment_method?: string;
  payment_date?: string;
  receipt_number?: string;
  notes?: string | null;
  recorded_by?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  students?: Student | null;
  student_fees?: StudentFee | null;
};

export type Expense = {
  id: string;
  campus_id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  payment_method?: string;
  notes?: string | null;
  created_at?: string;
  campuses?: Campus | null;
};

export type StaffMember = {
  id: string;
  campus_id: string;
  full_name: string;
  role?: string | null;
  phone?: string | null;
  salary: number;
  status?: "active" | "inactive" | string;
  start_date?: string | null;
  notes?: string | null;
  created_at?: string;
  campuses?: Campus | null;
};


export type InventoryItem = {
  id: string;
  name: string;
  category?: string | null;
  quantity: number;
  min_stock: number;
  unit?: string | null;
  campus_id?: string | null;
  notes?: string | null;
};
