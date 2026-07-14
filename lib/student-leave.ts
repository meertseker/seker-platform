/**
 * Öğrenci ayrılışında iptal edilecek taksitleri seçer: yalnızca 'bekliyor'
 * durumundaki taksitler iptal edilir; 'odendi' dokunulmaz kalır, 'iptal'
 * zaten sonuçlanmıştır (spec: markStudentLeft).
 */
export function installmentsToCancel<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.status === "bekliyor");
}
