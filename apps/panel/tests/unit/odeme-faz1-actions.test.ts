import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ödeme Faz 1 eylemleri: correctPayment ve closeRemainder. Veritabanı davranışı
 * tests/rls/odeme-faz1.test.ts'te; burada yetki, doğrulama ve RPC'ye giden biçim.
 */
type Row = Record<string, unknown>;
let role: "yonetici" | "danisman";
let installments: Row[];
let events: Row[];
let rpcCalls: { name: string; args: Record<string, unknown> }[];
let rpcResult: { data: unknown; error: unknown };

function table(rows: () => Row[]) {
  const filters: ((r: Row) => boolean)[] = [];
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = (col: string, value: unknown) => (filters.push((r) => r[col] === value), q);
  q.in = (col: string, values: unknown[]) => (filters.push((r) => values.includes(r[col])), q);
  q.contains = (_col: string, value: { paidIds: string[] }) =>
    (filters.push((r) => value.paidIds.every((id) => ((r.payload as { paidIds?: string[] }).paidIds ?? []).includes(id))), q);
  q.order = () => q;
  q.maybeSingle = async () => ({ data: rows().find((r) => filters.every((f) => f(r))) ?? null, error: null });
  q.then = (resolve: (v: unknown) => void) => resolve({ data: rows().filter((r) => filters.every((f) => f(r))), error: null });
  return q;
}

const from = vi.fn((name: string) => {
  if (name === "installments") return table(() => installments);
  if (name === "events") return table(() => events);
  throw new Error(`beklenmeyen tablo ${name}`);
});
const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
  rpcCalls.push({ name, args });
  return rpcResult;
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: async () => ({ id: "u1", role }) }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn(), kickWaFlush: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from, rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => null }));

import { closeRemainder, correctPayment } from "@/actions/payments";

beforeEach(() => {
  role = "yonetici";
  installments = [
    { id: "A", due_date: "2026-10-05", amount: 15000, paid_amount: 15000, paid_at: "2026-10-12T09:00:00Z", payment_method: "nakit", status: "odendi" },
    { id: "B", due_date: "2026-11-05", amount: 15000, paid_amount: 15000, paid_at: "2026-10-12T09:00:00Z", payment_method: "nakit", status: "odendi" },
    { id: "X", due_date: "2026-09-05", amount: 14495, paid_amount: 14495, paid_at: "2026-09-10T09:00:00Z", payment_method: "diger", status: "odendi" },
  ];
  events = [
    { id: "E0", event_type: "odeme_alindi", created_at: "2026-10-01T00:00:00Z", payload: { paidIds: ["A"], undone: true, snapshots: [{ id: "A", amount: 99 }] } },
    { id: "E1", event_type: "odeme_alindi", created_at: "2026-10-12T09:00:00Z", payload: { paidIds: ["A", "B"], snapshots: [{ id: "A", amount: 15000 }, { id: "B", amount: 15000 }] } },
  ];
  rpcCalls = [];
  rpcResult = { data: { studentId: "S1" }, error: null };
});

describe("correctPayment", () => {
  it("danışman reddedilir, RPC çağrılmaz", async () => {
    role = "danisman";
    const result = await correctPayment({ installmentId: "A", payments: [{ method: "havale", amountTl: 30000, paidOn: "2026-10-12" }] });
    expect(result.error).toContain("yalnız yönetici");
    expect(rpcCalls).toHaveLength(0);
  });

  it("olaylı ödeme: hedefler ödemenin bütün taksitleri, ödeme öncesi tutarlarıyla", async () => {
    const result = await correctPayment({
      installmentId: "B",
      payments: [{ method: "havale", amountTl: 20000, paidOn: "2026-10-12" }],
      note: " yanlış girilmiş ",
    });
    expect(result).toEqual({ totalTl: 20000, remainderTl: 10000 });
    expect(rpcCalls).toHaveLength(1);
    const { name, args } = rpcCalls[0];
    expect(name).toBe("correct_payment");
    expect(args.p_installment_id).toBe("B");
    expect(args.p_ops).toEqual([
      { id: "A", amount: 15000, parts: [{ amount: 15000, method: "havale" }], remainders: [] },
      { id: "B", amount: 15000, parts: [{ amount: 5000, method: "havale" }], remainders: [{ dueDate: "2026-11-05", amount: 10000 }] },
    ]);
    expect(args.p_payload).toMatchObject({ paidOn: "2026-10-12", methods: ["havale"], note: "yanlış girilmiş" });
  });

  it("olaysız (içe aktarma) satır: hedef yalnız o satır", async () => {
    await correctPayment({ installmentId: "X", payments: [{ method: "pos", amountTl: 14495, paidOn: "2026-09-10" }] });
    expect(rpcCalls[0].args.p_ops).toEqual([{ id: "X", amount: 14495, parts: [{ amount: 14495, method: "pos" }], remainders: [] }]);
  });

  it("taksit toplamını aşan tutar yol gösteren mesajla reddedilir", async () => {
    const result = await correctPayment({ installmentId: "X", payments: [{ method: "pos", amountTl: 15500, paidOn: "2026-09-10" }] });
    expect(result.error).toContain("Ödeme al");
    expect(rpcCalls).toHaveLength(0);
  });

  it("ileri tarih reddedilir; RPC hatası (engel) kullanıcıya olduğu gibi gösterilir", async () => {
    const future = await correctPayment({ installmentId: "A", payments: [{ method: "pos", amountTl: 1, paidOn: "2999-01-01" }] });
    expect(future.error).toContain("ileri olamaz");
    rpcResult = { data: null, error: { code: "P0001", message: "Bu ödeme düzeltilemez: ödemeden sonra başka işlem yapılmış (kalan taksit ödendi)." } };
    const blocked = await correctPayment({ installmentId: "A", payments: [{ method: "pos", amountTl: 30000, paidOn: "2026-10-12" }] });
    expect(blocked.error).toContain("kalan taksit ödendi");
  });
});

describe("closeRemainder", () => {
  it("danışman reddedilir", async () => {
    role = "danisman";
    expect((await closeRemainder("R", "küsurat")).error).toContain("yalnız yönetici");
    expect(rpcCalls).toHaveLength(0);
  });

  it("neden boşsa reddedilir", async () => {
    expect((await closeRemainder("R", "   ")).error).toContain("nedenini yazın");
    expect(rpcCalls).toHaveLength(0);
  });

  it("RPC'ye taksit ve kırpılmış neden gider; kalemin kapandığı döner", async () => {
    rpcResult = { data: { studentId: "S1", closed: true, planTotalTl: 44995 }, error: null };
    expect(await closeRemainder("R", " küsurat ")).toEqual({ closed: true, planTotalTl: 44995 });
    expect(rpcCalls[0]).toEqual({ name: "close_installment_remainder", args: { p_installment_id: "R", p_reason: "küsurat" } });
  });
});
