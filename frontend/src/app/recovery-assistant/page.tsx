'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, FolderOpen, ShieldX, XCircle } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import type { RecoveryAssistantReport, RecoveryAssistantState } from '@/types/electron';

const STEPS: { id: string; states: RecoveryAssistantState[] }[] = [
  { id: 'recovery.step.files', states: ['restoring', 'reopening', 'writing', 'complete'] },
  { id: 'recovery.step.unchanged', states: ['complete'] },
  { id: 'recovery.step.database', states: ['reopening', 'writing', 'complete'] },
  { id: 'recovery.step.restore', states: ['reopening', 'writing', 'complete'] },
  { id: 'recovery.step.continue', states: ['complete'] },
];

function isBusy(state: RecoveryAssistantState): boolean {
  return ['checking', 'restoring', 'reopening', 'writing'].includes(state);
}

export default function RecoveryAssistantPage() {
  const { t } = useI18n();
  const [state, setState] = useState<RecoveryAssistantState>('idle');
  const [selectionToken, setSelectionToken] = useState<string | null>(null);
  const [report, setReport] = useState<RecoveryAssistantReport | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>('');

  useEffect(() => {
    return window.electronAPI?.onRecoveryProgress?.(({ state: next }) => setState(next));
  }, []);

  const resultContent = useMemo(() => {
    if (!report) return null;
    if (report.overallStatus === 'green') return {
      icon: CheckCircle2,
      title: t('recovery.green.title'),
      body: t('recovery.green.body'),
      className: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    };
    if (report.overallStatus === 'yellow') return {
      icon: AlertTriangle,
      title: t('recovery.yellow.title'),
      body: t('recovery.yellow.body'),
      className: 'border-amber-300 bg-amber-50 text-amber-950',
    };
    return {
      icon: XCircle,
      title: t('recovery.red.title'),
      body: t('recovery.red.body'),
      className: 'border-red-300 bg-red-50 text-red-950',
    };
  }, [report, t]);

  async function chooseBackup() {
    setNotice('');
    try {
      const selected = await window.electronAPI?.chooseRecoveryBackup?.();
      if (!selected?.selected || !selected.token) return;
      setSelectionToken(selected.token);
      setReport(null);
      setReportId(null);
      setState('selected');
    } catch {
      setState('failed');
      setNotice(t('recovery.failed'));
    }
  }

  async function runCheck() {
    if (!selectionToken) return;
    setNotice('');
    setState('checking');
    try {
      const result = await window.electronAPI?.startRecoveryCheck?.(selectionToken);
      setSelectionToken(null);
      if (result?.cancelled) {
        setState('cancelled');
        setNotice(t('recovery.cancelled'));
        return;
      }
      if (!result?.success || !result.report || !result.reportId) {
        setState('failed');
        setNotice(result?.error || t('recovery.failed'));
        return;
      }
      setReport(result.report);
      setReportId(result.reportId);
      setState('complete');
    } catch {
      setSelectionToken(null);
      setState('failed');
      setNotice(t('recovery.failed'));
    }
  }

  async function cancelCheck() {
    try {
      const result = await window.electronAPI?.cancelRecoveryCheck?.();
      if (!result?.cancelled) return;
      setState('cancelled');
      setSelectionToken(null);
      setNotice(t('recovery.cancelled'));
    } catch {
      setState('failed');
      setNotice(t('recovery.failed'));
    }
  }

  async function saveReport() {
    if (!reportId) return;
    try {
      const saved = await window.electronAPI?.saveRecoveryReport?.(reportId);
      if (saved?.saved) setNotice(t('recovery.reportSaved'));
      else if (saved?.error) setNotice(saved.error);
    } catch {
      setNotice(t('recovery.failed'));
    }
  }

  return (
    <main data-testid="recovery-assistant" data-state={state} className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <section className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="mb-8 flex items-start gap-4">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-800" aria-hidden="true"><FileCheck2 size={32} /></div>
          <div>
            <h1 className="text-3xl font-bold">{t('recovery.title')}</h1>
            <p className="mt-2 max-w-2xl text-lg text-slate-600">{t('recovery.intro')}</p>
          </div>
        </header>

        {!report && !isBusy(state) && (
          <div className="rounded-xl border border-slate-200 p-6">
            <p className="mb-5 text-lg">{state === 'selected' ? t('recovery.selected') : t('recovery.chooseHint')}</p>
            <div className="flex flex-wrap gap-3">
              <button data-testid="choose-backup" type="button" onClick={chooseBackup} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white outline-offset-4 hover:bg-blue-800 focus-visible:outline-4 focus-visible:outline-blue-300">
                <FolderOpen aria-hidden="true" /> {t('recovery.choose')}
              </button>
              {state === 'selected' && (
                <button data-testid="start-check" type="button" onClick={runCheck} className="min-h-12 rounded-lg bg-emerald-700 px-6 py-3 font-semibold text-white outline-offset-4 hover:bg-emerald-800 focus-visible:outline-4 focus-visible:outline-emerald-300">
                  {t('recovery.start')}
                </button>
              )}
            </div>
          </div>
        )}

        {isBusy(state) && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6" aria-live="polite">
            <h2 className="text-xl font-semibold">{t('recovery.checking')}</h2>
            <ol className="mt-5 space-y-3">
              {STEPS.map((step, index) => {
                const done = step.states.includes(state);
                return <li key={step.id} className="flex items-center gap-3 text-base"><span aria-hidden="true" className={done ? 'text-emerald-700' : 'text-slate-400'}>{done ? '✓' : '○'}</span>{index + 1}. {t(step.id)}</li>;
              })}
            </ol>
            <button type="button" onClick={cancelCheck} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-slate-700 px-5 py-3 font-semibold outline-offset-4 hover:bg-white focus-visible:outline-4 focus-visible:outline-blue-300">
              <ShieldX aria-hidden="true" /> {t('recovery.cancel')}
            </button>
          </div>
        )}

        {resultContent && report && (
          <div data-testid={`result-${report.overallStatus}`} className={`rounded-xl border-2 p-6 ${resultContent.className}`} aria-live="polite">
            <div className="flex items-start gap-4">
              <resultContent.icon size={36} aria-hidden="true" />
              <div><h2 className="text-2xl font-bold">{resultContent.title}</h2><p className="mt-2 text-lg">{resultContent.body}</p></div>
            </div>
            {report.warnings.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-6">{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button data-testid="save-report" type="button" onClick={saveReport} className="min-h-12 rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white outline-offset-4 hover:bg-slate-800 focus-visible:outline-4 focus-visible:outline-blue-300">{t('recovery.saveReport')}</button>
              <button data-testid="check-another" type="button" onClick={chooseBackup} className="min-h-12 rounded-lg border-2 border-current px-6 py-3 font-semibold outline-offset-4 focus-visible:outline-4 focus-visible:outline-blue-300">{t('recovery.checkAnother')}</button>
            </div>
          </div>
        )}

        {notice && <p className="mt-5 rounded-lg bg-slate-100 p-4" role="status">{notice}</p>}

        {report && (
          <details data-testid="technical-details" className="mt-6 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer font-semibold outline-offset-4 focus-visible:outline-4 focus-visible:outline-blue-300">{t('recovery.technicalDetails')}</summary>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold">{t('recovery.detail.checksum')}</dt><dd>{String(report.checksumMatched)}</dd></div>
              <div><dt className="font-semibold">{t('recovery.detail.version')}</dt><dd>{report.backupSchemaVersion ?? t('recovery.detail.unknown')}</dd></div>
              <div><dt className="font-semibold">{t('recovery.detail.restore')}</dt><dd>{String(report.testRestoreSucceeded)}</dd></div>
              <div><dt className="font-semibold">{t('recovery.detail.write')}</dt><dd>{String(report.testWriteSucceeded)}</dd></div>
            </dl>
          </details>
        )}
      </section>
    </main>
  );
}
