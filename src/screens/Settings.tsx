import { Download, Moon, Share, Smartphone, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { exportData, importData, resetAll } from '../lib/actions';
import { importPlanFile } from '../lib/planfile';
import { getMeta, setMeta } from '../lib/db';
import { useUI } from '../lib/store';

export type Theme = 'system' | 'dark' | 'light';
export function applyTheme(t: Theme) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f2f2f7');
}

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function Settings() {
  const ui = useUI();
  const [theme, setTheme] = useState<Theme>('system');
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMeta<Theme>('theme').then((t) => t && setTheme(t));
  }, []);

  const changeTheme = (t: Theme) => {
    setTheme(t);
    setMeta('theme', t);
    applyTheme(t);
  };

  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ritual-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (f?: File) => {
    if (!f) return;
    try {
      const msg = await importAnyFile(f);
      if (msg) ui.toast(msg);
    } catch (e) {
      ui.toast((e as Error).message);
    }
  };

  return (
    <div className="screen">
      <div className="topbar" />
      <div className="large-title">Settings</div>
      <div className="subtitle">Ritual · data stays on this device</div>

      {isIOS() && !isStandalone() && (
        <div className="banner">
          <Smartphone size={26} color="var(--accent)" />
          <div className="small">
            <b>Install on iPhone:</b> tap <Share size={14} style={{ verticalAlign: -2 }} /> Share in Safari → <b>Add to Home Screen</b> so Ritual opens full-screen and works offline like an app.
          </div>
        </div>
      )}

      <div className="form-label">Appearance</div>
      <div className="form-group">
        <div className="field">
          <Moon size={20} className="muted" />
          <span className="grow">Theme</span>
          <div className="seg">
            {(['system', 'dark', 'light'] as Theme[]).map((t) => (
              <button key={t} className={theme === t ? 'on' : ''} onClick={() => changeTheme(t)} style={{ textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="form-label">Data</div>
      <div className="form-group">
        <button className="field" style={{ width: '100%' }} onClick={doExport}>
          <Download size={20} color="var(--accent)" /> <span className="grow" style={{ textAlign: 'left' }}>Export backup</span>
        </button>
        <button className="field" style={{ width: '100%' }} onClick={() => file.current?.click()}>
          <Upload size={20} color="var(--accent)" /> <span className="grow" style={{ textAlign: 'left' }}>Import plans or restore backup</span>
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            doImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          className="field"
          style={{ width: '100%', color: 'var(--red)' }}
          onClick={async () => {
            if (confirm('Delete all plans, items and history on this device? This cannot be undone.')) {
              await resetAll();
              ui.toast('All data deleted');
            }
          }}
        >
          <Trash2 size={20} /> <span className="grow" style={{ textAlign: 'left' }}>Delete all data</span>
        </button>
      </div>
      <div className="form-hint">Plan files (from “Share plan”) are added next to your existing plans. A full backup replaces everything. Your data lives only in this browser — export a backup before switching phones.</div>
    </div>
  );
}

/** Accepts either a plan file (merged) or a full backup (replaces, after confirmation). */
export async function importAnyFile(f: File): Promise<string | undefined> {
  let data: { app?: string; type?: string };
  try {
    data = JSON.parse(await f.text());
  } catch {
    throw new Error('That file isn’t valid JSON');
  }
  if (data?.app !== 'ritual') throw new Error('Not a Ritual file');
  if (data.type === 'plans') {
    const r = await importPlanFile(data);
    return `Added ${r.plans} plan${r.plans === 1 ? '' : 's'} with ${r.items} items`;
  }
  if (!confirm('This is a full backup. Restoring it replaces ALL current plans, history, check-ins and photos. Continue?')) return;
  await importData(data as Parameters<typeof importData>[0]);
  return 'Backup restored';
}
