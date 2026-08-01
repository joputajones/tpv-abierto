export type RecoveryOverallStatus = 'green' | 'yellow' | 'red';
export type RecoveryCheckStatus = 'passed' | 'warning' | 'failed';

export interface RecoveryCheckResult {
  id: string;
  status: RecoveryCheckStatus;
}

export interface RecoveryAssistantReport {
  reportVersion: 1;
  dateUtc: string;
  appVersion: string;
  overallStatus: RecoveryOverallStatus;
  checkResults: RecoveryCheckResult[];
  warnings: string[];
  recommendedAction: string;
  backupSize: number | null;
  backupSchemaVersion: number | null;
  manifestFormatVersion: number | null;
  checksumMatched: boolean | null;
  testRestoreSucceeded: boolean;
  testWriteSucceeded: boolean;
  platform: NodeJS.Platform;
}

const ALLOWED_REPORT_FIELDS = new Set([
  'reportVersion',
  'dateUtc',
  'appVersion',
  'overallStatus',
  'checkResults',
  'warnings',
  'recommendedAction',
  'backupSize',
  'backupSchemaVersion',
  'manifestFormatVersion',
  'checksumMatched',
  'testRestoreSucceeded',
  'testWriteSucceeded',
  'platform',
]);

const FORBIDDEN_FIELD_FRAGMENT = /(path|username|restaurant|customer|employee|product|order|sale|token|stack|rowid|message)/i;

export function assertSanitizedRecoveryReport(value: unknown): asserts value is RecoveryAssistantReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('REPORT_INVALID');
  const report = value as Record<string, unknown>;
  for (const key of Object.keys(report)) {
    if (!ALLOWED_REPORT_FIELDS.has(key) || FORBIDDEN_FIELD_FRAGMENT.test(key)) throw new Error('REPORT_FORBIDDEN_FIELD');
  }
  if (Object.keys(report).length !== ALLOWED_REPORT_FIELDS.size) throw new Error('REPORT_MISSING_FIELD');
  if (report.reportVersion !== 1) throw new Error('REPORT_VERSION_INVALID');
  if (!['green', 'yellow', 'red'].includes(String(report.overallStatus))) throw new Error('REPORT_STATUS_INVALID');
  if (!Array.isArray(report.checkResults) || !report.checkResults.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const keys = Object.keys(item as object).sort();
    return keys.length === 2 && keys[0] === 'id' && keys[1] === 'status'
      && typeof (item as RecoveryCheckResult).id === 'string'
      && ['passed', 'warning', 'failed'].includes((item as RecoveryCheckResult).status);
  })) throw new Error('REPORT_CHECKS_INVALID');
  if (!Array.isArray(report.warnings) || !report.warnings.every((warning) => typeof warning === 'string')) {
    throw new Error('REPORT_WARNINGS_INVALID');
  }
  const serialized = JSON.stringify(report);
  if (/([A-Za-z]:\\|\/Users\/|\/home\/|\\Users\\)/i.test(serialized)) throw new Error('REPORT_PATH_DETECTED');
}

export function recoveryReportAsText(report: RecoveryAssistantReport): string {
  assertSanitizedRecoveryReport(report);
  const status = report.overallStatus === 'green'
    ? 'COPIA COMPROBADA'
    : report.overallStatus === 'yellow'
      ? 'COPIA CON ADVERTENCIAS'
      : 'NO UTILIZAR';
  return [
    'INFORME DE COMPROBACION DE COPIA',
    `Fecha UTC: ${report.dateUtc}`,
    `Resultado: ${status}`,
    `Accion recomendada: ${report.recommendedAction}`,
    `Recuperacion de prueba: ${report.testRestoreSucceeded ? 'correcta' : 'no completada'}`,
    `Guardado de prueba: ${report.testWriteSucceeded ? 'correcto' : 'no completado'}`,
    report.warnings.length ? `Advertencias: ${report.warnings.join('; ')}` : 'Advertencias: ninguna',
    '',
  ].join('\n');
}

export const FRIENDLY_FAILURES: Record<string, string> = {
  CHECKSUM_MISMATCH: 'La copia ha cambiado desde que se creó. Conserva el archivo y utiliza otra copia.',
  MANIFEST_HASH_MISMATCH: 'La información de la copia no coincide con el archivo. No utilices esta copia.',
  SIZE_MISMATCH: 'La copia está incompleta o dañada. Conserva el archivo y utiliza otra copia.',
  INTEGRITY_FAILED: 'La copia parece estar dañada y no puede comprobarse con seguridad.',
  SCHEMA_NEWER: 'Esta copia fue creada con una versión más nueva de FloCafe. Actualiza FloCafe antes de volver a comprobarla.',
  SCHEMA_INCONSISTENT: 'La información interna de la copia no coincide. No utilices esta copia.',
  MANIFEST_SCHEMA_MISMATCH: 'La versión indicada por la copia no coincide con su contenido. No utilices esta copia.',
  RESTORE_FAILED: 'No se ha podido recuperar la copia en el entorno de prueba. Utiliza otra copia.',
  REOPEN_FAILED: 'La copia recuperada no ha podido abrirse de nuevo. Utiliza otra copia.',
  WRITE_FAILED: 'La copia se abre, pero no permite seguir guardando datos con seguridad.',
  UNEXPECTED_FILE_SET: 'La carpeta contiene archivos que no pertenecen a una copia válida.',
  INCOMPLETE_PACKAGE: 'Falta uno de los archivos necesarios para comprobar este paquete.',
  UNSAFE_PACKAGE_ENTRY: 'La carpeta contiene un elemento que no puede comprobarse con seguridad.',
  UNSAFE_SELECTION: 'El elemento elegido no puede comprobarse con seguridad.',
  CANCELLED: 'La comprobación se ha cancelado. La copia seleccionada no se ha modificado.',
};

export function friendlyFailure(code: string): string {
  return FRIENDLY_FAILURES[code] || 'No se ha podido completar la comprobación. Conserva la copia original y utiliza otra copia.';
}
