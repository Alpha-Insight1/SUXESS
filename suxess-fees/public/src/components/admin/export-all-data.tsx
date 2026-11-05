"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv, todayStamp } from "@/lib/export-csv";
import { Download } from "lucide-react";

export function ExportAllData() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const run = async () => {
    if (
      !confirm(
        "Download all main data as Excel-ready CSV files? Several files will download (students, payments, fees, expenses, teacher pay, staff, inventory)."
      )
    ) {
      return;
    }
    setLoading(true);
    setMessage("Preparing files…");
    const stamp = todayStamp();
    const errors: string[] = [];

    try {
      setMessage("Students…");
      {
        const { data, error } = await supabase
          .from("students")
          .select(
            "admission_number, full_name, class_name, department, status, parent_name, parent_phone, parent_email, address, exam_preparing_for, created_at, campuses(short_name, name)"
          )
          .order("created_at", { ascending: false })
          .limit(5000);
        if (error) errors.push("Students: " + error.message);
        else {
          const rows = (data || []).map((s: any) => {
            const c = Array.isArray(s.campuses) ? s.campuses[0] : s.campuses;
            return [
              s.admission_number,
              s.full_name,
              c?.short_name || c?.name || "",
              s.class_name,
              s.department,
              s.status,
              s.parent_name,
              s.parent_phone,
              s.parent_email,
              s.address,
              s.exam_preparing_for,
              s.created_at,
            ];
          });
          downloadCsv(
            `suxess-students-${stamp}.csv`,
            [
              "Admission No",
              "Full Name",
              "Campus",
              "Class",
              "Department",
              "Status",
              "Parent Name",
              "Parent Phone",
              "Parent Email",
              "Address",
              "Exam Preparing",
              "Registered At",
            ],
            rows
          );
          await sleep(400);
        }
      }

      setMessage("Payments…");
      {
        const { data, error } = await supabase
          .from("payments")
          .select(
            "receipt_number, amount, payment_date, payment_method, notes, deleted_at, students(full_name, admission_number, campuses(short_name)), student_fees(session, term, fee_types(name))"
          )
          .order("payment_date", { ascending: false })
          .limit(8000);
        if (error) errors.push("Payments: " + error.message);
        else {
          const rows = (data || []).map((p: any) => {
            const st = Array.isArray(p.students) ? p.students[0] : p.students;
            const c = Array.isArray(st?.campuses)
              ? st?.campuses[0]
              : st?.campuses;
            const sf = Array.isArray(p.student_fees)
              ? p.student_fees[0]
              : p.student_fees;
            const ft = Array.isArray(sf?.fee_types)
              ? sf?.fee_types[0]
              : sf?.fee_types;
            return [
              p.receipt_number,
              st?.full_name,
              st?.admission_number,
              c?.short_name || "",
              ft?.name || "",
              sf?.session || "",
              sf?.term || "",
              p.amount,
              p.payment_date,
              p.payment_method,
              p.deleted_at ? "Voided" : "Active",
              p.notes,
            ];
          });
          downloadCsv(
            `suxess-payments-${stamp}.csv`,
            [
              "Receipt",
              "Student",
              "Admission No",
              "Campus",
              "Fee Type",
              "Session",
              "Term",
              "Amount",
              "Date",
              "Method",
              "Status",
              "Notes",
            ],
            rows
          );
          await sleep(400);
        }
      }

      setMessage("Fee balances…");
      {
        const { data, error } = await supabase
          .from("student_fees")
          .select(
            "amount, amount_paid, balance, status, session, term, valid_until, board_deadline, board_registered, students(full_name, admission_number, campuses(short_name)), fee_types(name)"
          )
          .order("created_at", { ascending: false })
          .limit(8000);
        if (error) errors.push("Fees: " + error.message);
        else {
          const rows = (data || []).map((f: any) => {
            const st = Array.isArray(f.students) ? f.students[0] : f.students;
            const c = Array.isArray(st?.campuses)
              ? st?.campuses[0]
              : st?.campuses;
            const ft = Array.isArray(f.fee_types) ? f.fee_types[0] : f.fee_types;
            return [
              st?.full_name,
              st?.admission_number,
              c?.short_name || "",
              ft?.name || "",
              f.session,
              f.term,
              f.amount,
              f.amount_paid,
              f.balance,
              f.status,
              f.valid_until,
              f.board_deadline,
              f.board_registered ? "Yes" : "No",
            ];
          });
          downloadCsv(
            `suxess-fee-balances-${stamp}.csv`,
            [
              "Student",
              "Admission No",
              "Campus",
              "Fee Type",
              "Session",
              "Term",
              "Fee Amount",
              "Paid",
              "Balance",
              "Status",
              "Card Valid Until",
              "Exam Deadline",
              "Board Registered",
            ],
            rows
          );
          await sleep(400);
        }
      }

      setMessage("Expenses…");
      {
        const { data, error } = await supabase
          .from("expenses")
          .select(
            "expense_date, category, description, amount, payment_method, campuses(short_name, name)"
          )
          .order("expense_date", { ascending: false })
          .limit(5000);
        if (error) errors.push("Expenses: " + error.message);
        else {
          const rows = (data || []).map((e: any) => {
            const c = Array.isArray(e.campuses) ? e.campuses[0] : e.campuses;
            return [
              e.expense_date,
              c?.short_name || c?.name || "",
              e.category,
              e.description,
              e.amount,
              e.payment_method,
            ];
          });
          downloadCsv(
            `suxess-expenses-${stamp}.csv`,
            ["Date", "Campus", "Category", "Description", "Amount", "Method"],
            rows
          );
          await sleep(400);
        }
      }

      setMessage("Teacher pay…");
      {
        const { data, error } = await supabase
          .from("teacher_payments")
          .select(
            "payment_date, teacher_name, period_taught, amount, payment_method, notes, campuses(short_name, name)"
          )
          .order("payment_date", { ascending: false })
          .limit(5000);
        if (error) errors.push("Teacher pay: " + error.message);
        else {
          const rows = (data || []).map((e: any) => {
            const c = Array.isArray(e.campuses) ? e.campuses[0] : e.campuses;
            return [
              e.payment_date,
              c?.short_name || c?.name || "",
              e.teacher_name,
              e.period_taught,
              e.amount,
              e.payment_method,
              e.notes,
            ];
          });
          downloadCsv(
            `suxess-teacher-pay-${stamp}.csv`,
            [
              "Date",
              "Campus",
              "Teacher",
              "Period",
              "Amount",
              "Method",
              "Notes",
            ],
            rows
          );
          await sleep(400);
        }
      }

      setMessage("Staff…");
      {
        const { data, error } = await supabase
          .from("staff")
          .select(
            "full_name, role_title, phone, salary, status, campuses(short_name, name)"
          )
          .limit(2000);
        if (error) errors.push("Staff: " + error.message);
        else {
          const rows = (data || []).map((s: any) => {
            const c = Array.isArray(s.campuses) ? s.campuses[0] : s.campuses;
            return [
              s.full_name,
              c?.short_name || c?.name || "",
              s.role_title,
              s.phone,
              s.salary,
              s.status,
            ];
          });
          downloadCsv(
            `suxess-staff-${stamp}.csv`,
            ["Name", "Campus", "Role", "Phone", "Salary", "Status"],
            rows
          );
          await sleep(400);
        }
      }

      setMessage("Inventory…");
      {
        const { data, error } = await supabase
          .from("inventory_items")
          .select(
            "name, category, quantity, unit, cost_price, selling_price, campuses(short_name, name)"
          )
          .limit(2000);
        if (error) errors.push("Inventory: " + error.message);
        else {
          const rows = (data || []).map((i: any) => {
            const c = Array.isArray(i.campuses) ? i.campuses[0] : i.campuses;
            return [
              i.name,
              c?.short_name || c?.name || "",
              i.category,
              i.quantity,
              i.unit,
              i.cost_price,
              i.selling_price,
            ];
          });
          downloadCsv(
            `suxess-inventory-${stamp}.csv`,
            [
              "Item",
              "Campus",
              "Category",
              "Qty",
              "Unit",
              "Cost Price",
              "Selling Price",
            ],
            rows
          );
        }
      }

      if (errors.length) {
        setMessage("Done with some errors: " + errors.join("; "));
      } else {
        setMessage(
          "Download complete. Open the CSV files in Excel. Check your Downloads folder."
        );
      }
    } catch (e: any) {
      setMessage(e?.message || "Export failed");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-brand-green/10">
          <Download className="w-5 h-5 text-brand-green" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">Download all data</h3>
          <p className="text-sm text-gray-500 mt-1">
            Excel-ready CSV files: students, payments, balances, expenses,
            teacher pay, staff, inventory. For the director&apos;s records and
            backup.
          </p>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {loading ? message || "Downloading…" : "Download all (Excel CSV)"}
          </button>
          {message && !loading && (
            <p className="text-xs text-gray-500 mt-2">{message}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Allow multiple downloads in your browser if prompted. Each file
            opens in Microsoft Excel or Google Sheets.
          </p>
        </div>
      </div>
    </div>
  );
}
