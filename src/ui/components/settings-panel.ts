import { ALL_ACTIONS, ALL_MODES, type RobotAction } from './action-bar';

// ── Persisted keys ──────────────────────────────────────────────────────────
export const ICON_SIZE_KEY  = 'go2_icon_size';
export const SHOW_LABELS_KEY = 'go2_show_labels';
const SHORTCUTS_KEY  = 'go2_shortcuts';
const SETTINGS_KEY   = 'go2_ui_settings'; // shared with side-buttons.ts
const POS_KEYS = ['go2_actionbar_pos', 'go2_settingbar_pos', 'go2_pip_pos', 'go2_float_player_pos'];

export type IconSize = 'small' | 'medium' | 'large';
type ShortcutRef = { type: 'action' | 'mode'; index: number };
interface SavedUiSettings { pipVisible: boolean; joysticksOn: boolean }

// ── Helpers ─────────────────────────────────────────────────────────────────
export function getIconSize(): IconSize {
  return (localStorage.getItem(ICON_SIZE_KEY) as IconSize) ?? 'medium';
}
export function getShowLabels(): boolean {
  const v = localStorage.getItem(SHOW_LABELS_KEY);
  return v === null ? true : v === 'true';
}
function loadUiSettings(): SavedUiSettings {
  try { const s = localStorage.getItem(SETTINGS_KEY); if (s) return JSON.parse(s); }
  catch { /* ignore */ }
  return { pipVisible: true, joysticksOn: true };
}
function saveUiSettings(s: SavedUiSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
function loadShortcuts(): ShortcutRef[] {
  try { const s = localStorage.getItem(SHORTCUTS_KEY); return s ? JSON.parse(s) : []; }
  catch { return []; }
}
function saveShortcutsRaw(refs: ShortcutRef[]): void {
  try { localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(refs)); } catch { /* ignore */ }
}

// ── Callbacks ────────────────────────────────────────────────────────────────
export interface SettingsPanelCallbacks {
  onIconSizeChange?:   (size: IconSize) => void;
  onShowLabelsChange?: (show: boolean)  => void;
  onPipChange?:        (visible: boolean) => void;
  onJoysticksChange?:  (enabled: boolean) => void;
  onResetLayout?:      () => void;
  onShortcutsChange?:  () => void;
}

// ── Panel ────────────────────────────────────────────────────────────────────
export class SettingsPanel {
  private overlay: HTMLElement | null = null;
  private parent: HTMLElement;
  private callbacks: SettingsPanelCallbacks;

  constructor(parent: HTMLElement, callbacks: SettingsPanelCallbacks) {
    this.parent = parent;
    this.callbacks = callbacks;
  }

  toggle(): void { this.overlay ? this.close() : this.open(); }

  open(): void {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.addEventListener('pointerdown', (e) => {
      if (e.target === this.overlay) this.close();
    });

    const panel = document.createElement('div');
    panel.className = 'settings-panel';

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'settings-header';
    const title = document.createElement('span');
    title.className = 'settings-title';
    title.textContent = 'Settings';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close-btn';
    closeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <line x1="3" y1="3" x2="15" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <line x1="15" y1="3" x2="3" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ── Body ────────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'settings-body';

    body.appendChild(this.buildLayoutSection());
    body.appendChild(this.buildShortcutsSection());
    body.appendChild(this.buildDisplaySection());
    body.appendChild(this.buildConnectionSection());

    panel.appendChild(body);
    this.overlay.appendChild(panel);
    this.parent.appendChild(this.overlay);

    // Animate in
    requestAnimationFrame(() => panel.classList.add('settings-panel--open'));
  }

  close(): void {
    if (!this.overlay) return;
    const panel = this.overlay.querySelector('.settings-panel') as HTMLElement;
    panel?.classList.remove('settings-panel--open');
    setTimeout(() => { this.overlay?.remove(); this.overlay = null; }, 250);
  }

  // ── SECTION: Layout ────────────────────────────────────────────────────────
  private buildLayoutSection(): HTMLElement {
    const sec = this.makeSection('Layout');

    // Reset positions
    const resetRow = this.makeRow('Reset all panel positions');
    const resetBtn = this.makeActionBtn('Reset', 'settings-btn-danger', () => {
      POS_KEYS.forEach(k => localStorage.removeItem(k));
      this.callbacks.onResetLayout?.();
      resetBtn.textContent = 'Done!';
      setTimeout(() => { resetBtn.textContent = 'Reset'; }, 1500);
    });
    resetRow.appendChild(resetBtn);
    sec.appendChild(resetRow);

    // Clear all saved data
    const clearRow = this.makeRow('Clear all saved data & restart');
    const clearBtn = this.makeActionBtn('Clear', 'settings-btn-danger', () => {
      if (clearBtn.textContent === 'Sure?') {
        localStorage.clear();
        location.reload();
      } else {
        clearBtn.textContent = 'Sure?';
        setTimeout(() => { clearBtn.textContent = 'Clear'; }, 2000);
      }
    });
    clearRow.appendChild(clearBtn);
    sec.appendChild(clearRow);

    return sec;
  }

  // ── SECTION: Shortcuts Bar ─────────────────────────────────────────────────
  private buildShortcutsSection(): HTMLElement {
    const sec = this.makeSection('Shortcuts Bar');

    // Icon size
    const sizeRow = this.makeRow('Icon size');
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'settings-btn-group';
    const currentSize = getIconSize();
    (['small', 'medium', 'large'] as IconSize[]).forEach(size => {
      const btn = document.createElement('button');
      btn.className = `settings-seg-btn${currentSize === size ? ' active' : ''}`;
      btn.textContent = size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L';
      btn.addEventListener('click', () => {
        sizeGroup.querySelectorAll('.settings-seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem(ICON_SIZE_KEY, size);
        this.callbacks.onIconSizeChange?.(size);
      });
      sizeGroup.appendChild(btn);
    });
    sizeRow.appendChild(sizeGroup);
    sec.appendChild(sizeRow);

    // Show labels
    const labelsRow = this.makeRow('Show icon labels');
    labelsRow.appendChild(this.makeToggle(getShowLabels(), v => {
      localStorage.setItem(SHOW_LABELS_KEY, String(v));
      this.callbacks.onShowLabelsChange?.(v);
    }));
    sec.appendChild(labelsRow);

    // Manage shortcuts — expandable
    const manageRow = this.makeRow('Manage shortcuts');
    const editBtn = this.makeActionBtn('Edit', '', () => {
      const isOpen = editArea.style.display !== 'none';
      editArea.style.display = isOpen ? 'none' : 'block';
      editBtn.textContent = isOpen ? 'Edit' : 'Done';
      if (!isOpen) this.buildShortcutsUI(editArea);
    });
    manageRow.appendChild(editBtn);
    sec.appendChild(manageRow);

    const editArea = document.createElement('div');
    editArea.className = 'settings-shortcuts-area';
    editArea.style.display = 'none';
    sec.appendChild(editArea);

    return sec;
  }

  // ── SECTION: Display ───────────────────────────────────────────────────────
  private buildDisplaySection(): HTMLElement {
    const sec = this.makeSection('Display');
    const saved = loadUiSettings();

    // PIP
    const pipRow = this.makeRow('Picture-in-Picture window');
    pipRow.appendChild(this.makeToggle(saved.pipVisible, v => {
      const s = loadUiSettings(); s.pipVisible = v; saveUiSettings(s);
      this.callbacks.onPipChange?.(v);
    }));
    sec.appendChild(pipRow);

    // Joysticks
    const joyRow = this.makeRow('Joystick controls');
    joyRow.appendChild(this.makeToggle(saved.joysticksOn, v => {
      const s = loadUiSettings(); s.joysticksOn = v; saveUiSettings(s);
      this.callbacks.onJoysticksChange?.(v);
    }));
    sec.appendChild(joyRow);

    return sec;
  }

  // ── SECTION: Connection ────────────────────────────────────────────────────
  private buildConnectionSection(): HTMLElement {
    const sec = this.makeSection('Connection');

    const ipRow = this.makeRow('Default Robot IP');
    const ipInput = document.createElement('input');
    ipInput.type = 'text';
    ipInput.className = 'settings-input';
    ipInput.value = localStorage.getItem('go2_last_ip') ?? '';
    ipInput.placeholder = '192.168.12.1';
    ipInput.addEventListener('blur', () => {
      const v = ipInput.value.trim();
      if (v) localStorage.setItem('go2_last_ip', v);
    });
    ipRow.appendChild(ipInput);
    sec.appendChild(ipRow);

    return sec;
  }

  // ── Shortcuts edit UI ──────────────────────────────────────────────────────
  private buildShortcutsUI(container: HTMLElement): void {
    container.innerHTML = '';

    // ── Current bar order ────
    const listTitle = document.createElement('div');
    listTitle.className = 'settings-sub-title';
    listTitle.textContent = 'Current bar order — drag to reorder';
    container.appendChild(listTitle);

    const list = document.createElement('div');
    list.className = 'action-reorder-list';
    container.appendChild(list);

    const rebuildList = () => {
      list.innerHTML = '';
      loadShortcuts().forEach((ref, i) => {
        const srcList = ref.type === 'action' ? ALL_ACTIONS : ALL_MODES;
        const action = srcList[ref.index];
        if (!action) return;

        const item = document.createElement('div');
        item.className = 'action-reorder-item';
        item.dataset['idx'] = String(i);
        item.innerHTML = `
          <span class="action-reorder-handle">≡</span>
          <img src="${action.icon}" width="22" height="22" draggable="false"/>
          <span class="action-reorder-name">${action.name}</span>
          <span class="settings-badge-type">${ref.type === 'action' ? 'A' : 'M'}</span>
          <button class="action-reorder-remove" title="Remove">×</button>
        `;
        item.querySelector('.action-reorder-remove')!.addEventListener('click', () => {
          const refs = loadShortcuts(); refs.splice(i, 1); saveShortcutsRaw(refs);
          this.callbacks.onShortcutsChange?.();
          rebuildList(); rebuildAllGrid();
        });
        this.attachSettingsDrag(item, list, rebuildList);
        list.appendChild(item);
      });
    };
    rebuildList();

    // ── Add to bar ───────────────────────────────────────────────────────────
    const addTitle = document.createElement('div');
    addTitle.className = 'settings-sub-title';
    addTitle.style.marginTop = '12px';
    addTitle.textContent = 'Add to bar';
    container.appendChild(addTitle);

    const allGrid = document.createElement('div');
    container.appendChild(allGrid);

    const rebuildAllGrid = () => {
      allGrid.innerHTML = '';
      const current = loadShortcuts();
      this.addItemSection(allGrid, ALL_ACTIONS, 'action', 'Actions', current, rebuildList, rebuildAllGrid);
      this.addItemSection(allGrid, ALL_MODES, 'mode', 'Modes', current, rebuildList, rebuildAllGrid);
    };
    rebuildAllGrid();
  }

  private addItemSection(
    container: HTMLElement,
    items: RobotAction[],
    type: 'action' | 'mode',
    title: string,
    current: ShortcutRef[],
    rebuildList: () => void,
    rebuildAllGrid: () => void,
  ): void {
    const secTitle = document.createElement('div');
    secTitle.className = 'settings-sub-title';
    secTitle.style.color = '#888';
    secTitle.textContent = title;
    container.appendChild(secTitle);

    const grid = document.createElement('div');
    grid.className = 'action-popup-grid';
    container.appendChild(grid);

    items.forEach((action, idx) => {
      const inBar = current.some(s => s.type === type && s.index === idx);
      const item = document.createElement('div');
      item.className = `action-popup-item${inBar ? ' settings-item-inbar' : ''}`;
      item.innerHTML = `
        <div class="action-popup-icon"><img src="${action.icon}" alt="${action.name}" draggable="false"/></div>
        <span class="action-popup-label">${action.name}</span>
        <div class="action-popup-badge ${inBar ? 'badge-remove' : 'badge-add'}">${inBar ? '−' : '+'}</div>
      `;
      item.querySelector('.action-popup-badge')!.addEventListener('click', () => {
        const refs = loadShortcuts();
        if (inBar) {
          const filtered = refs.filter(s => !(s.type === type && s.index === idx));
          saveShortcutsRaw(filtered);
        } else {
          refs.push({ type, index: idx });
          saveShortcutsRaw(refs);
        }
        this.callbacks.onShortcutsChange?.();
        rebuildList(); rebuildAllGrid();
      });
      grid.appendChild(item);
    });
  }

  private attachSettingsDrag(item: HTMLElement, list: HTMLElement, rebuild: () => void): void {
    const handle = item.querySelector('.action-reorder-handle') as HTMLElement;
    let dragging = false;
    let startY = 0;
    let currentIdx = 0;

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      item.style.transform = `translateY(${e.clientY - startY}px)`;

      const siblings = Array.from(
        list.querySelectorAll('.action-reorder-item:not(.action-reorder-dragging)')
      ) as HTMLElement[];

      for (const sib of siblings) {
        const sibIdx = parseInt(sib.dataset['idx'] ?? '-1', 10);
        if (sibIdx < 0) continue;
        const rect = sib.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;

        if (sibIdx === currentIdx - 1 && e.clientY < mid) {
          const refs = loadShortcuts();
          [refs[currentIdx], refs[sibIdx]] = [refs[sibIdx], refs[currentIdx]];
          saveShortcutsRaw(refs);
          this.callbacks.onShortcutsChange?.();
          currentIdx = sibIdx; startY = e.clientY;
          item.style.transform = ''; rebuild(); return;
        }
        if (sibIdx === currentIdx + 1 && e.clientY > mid) {
          const refs = loadShortcuts();
          [refs[currentIdx], refs[sibIdx]] = [refs[sibIdx], refs[currentIdx]];
          saveShortcutsRaw(refs);
          this.callbacks.onShortcutsChange?.();
          currentIdx = sibIdx; startY = e.clientY;
          item.style.transform = ''; rebuild(); return;
        }
      }
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      item.style.transform = '';
      item.classList.remove('action-reorder-dragging');
      rebuild();
    };

    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      dragging = true; startY = e.clientY;
      currentIdx = parseInt(item.dataset['idx'] ?? '0', 10);
      item.classList.add('action-reorder-dragging');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private makeSection(title: string): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'settings-section';
    const heading = document.createElement('div');
    heading.className = 'settings-section-title';
    heading.textContent = title;
    sec.appendChild(heading);
    return sec;
  }

  private makeRow(label: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-row';
    const lbl = document.createElement('span');
    lbl.className = 'settings-row-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    return row;
  }

  private makeActionBtn(text: string, extraClass: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `settings-btn-action${extraClass ? ' ' + extraClass : ''}`;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private makeToggle(initialValue: boolean, onChange: (v: boolean) => void): HTMLElement {
    const label = document.createElement('label');
    label.className = 'settings-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initialValue;
    input.addEventListener('change', () => onChange(input.checked));
    const slider = document.createElement('span');
    slider.className = 'settings-toggle-slider';
    label.appendChild(input);
    label.appendChild(slider);
    return label;
  }
}
