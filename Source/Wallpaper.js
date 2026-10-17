/* Codex Wallpaper — local, reversible theme runtime. No chat content is read. */
(config => {
  const key = '__codexWallpaperLocalV1';
  const prior = window[key];
  if (prior?.revision === config.revision) {
    prior.touched = Date.now();
    return { applied: true, reused: true };
  }
  prior?.restore();
  if (!document.querySelector('[data-app-shell-frame]') || !document.querySelector('[data-app-shell-main-surface]')) {
    return { applied: false, reason: '当前窗口没有可识别的 Codex 主界面。' };
  }
  const p = config.palette;
  const color = x => /^#[0-9a-f]{6}$/i.test(x);
  if (![p.base, p.panel, p.text, p.muted, p.accent, p.border].every(color)) throw Error('Invalid palette');
  if (config.image && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(config.image)) throw Error('Invalid image');
  const strength = Math.min(.85, Math.max(0, Number(config.strength) || 0));
  const blur = Math.min(30, Math.max(0, Number(config.blur) || 0));
  const position = Math.min(100, Math.max(0, Number.isFinite(Number(config.position)) ? Number(config.position) : 50));
  const horizontalOffset = Math.min(100, Math.max(-100, Number(config.horizontalOffset) || 0));
  const zoom = Math.min(3, Math.max(.25, Number(config.zoom) || 1));
  const style = document.createElement('style');
  style.id = 'codex-wallpaper-local-style';
  const declarations = {
    '--app-color-background-surface': p.base,
    '--app-color-background-surface-under': p.base,
    '--app-color-background-shell': p.base,
    '--app-color-background-card': p.panel,
    '--app-color-background-control': p.panel,
    '--app-color-background-elevated-primary': p.panel,
    '--app-color-background-elevated-primary-opaque': p.panel,
    '--app-color-background-elevated-secondary': p.panel,
    '--app-color-background-elevated-secondary-opaque': p.panel,
    '--app-color-background-editor-opaque': p.panel,
    '--app-color-background-application-menu': p.panel,
    '--app-color-foreground-application-menu': p.text,
    '--app-color-text-foreground': p.text,
    '--app-color-text-foreground-secondary': p.muted,
    '--app-color-text-foreground-tertiary': p.muted,
    '--app-color-icon-primary': p.text,
    '--app-color-icon-secondary': p.muted,
    '--app-color-icon-tertiary': p.muted,
    '--app-color-text-accent': p.accent,
    '--app-color-border': p.border,
    '--app-color-border-light': p.border,
    '--app-color-border-heavy': p.border,
    '--color-surface': p.base,
    '--color-surface-canvas': p.base,
    '--color-surface-secondary': p.panel,
    '--color-surface-tertiary': p.panel,
    '--color-surface-elevated': p.panel,
    '--color-surface-elevated-secondary': p.panel,
    '--color-background-control-opaque': p.panel,
    '--color-background-composer-surface': p.panel,
    '--color-background-composer-action-bar': p.panel,
    '--color-background-primary-ghost-hover': p.border,
    '--color-background-primary-ghost-active': p.border,
    '--color-background-secondary-ghost-hover': p.border,
    '--color-background-primary-solid': p.text,
    '--color-text-primary-solid': p.base,
    '--color-background-panel': p.panel,
    '--color-text': p.text,
    '--color-text-primary': p.text,
    '--color-text-secondary': p.muted,
    '--color-text-tertiary': p.muted,
    '--color-text-emphasis': p.text,
    '--color-text-prose': p.text,
    '--color-icon': p.text,
    '--color-border': p.border,
    '--color-border-subtle': p.border,
    '--color-border-strong': p.border,
    '--color-token-main-surface-primary': p.base,
    '--color-token-side-bar-background': p.base,
    '--color-token-bg-primary': p.base,
    '--color-token-foreground': p.text,
    '--color-token-text-primary': p.text,
    '--color-token-text-secondary': p.muted,
    '--color-token-description-foreground': p.muted,
    '--color-token-text-link-foreground': p.accent,
    '--color-token-dropdown-background': p.panel,
    '--color-token-dropdown-foreground': p.text
  };
  style.textContent = `
    :root, :root [data-theme] { ${Object.entries(declarations).map(([k,v])=>`${k}:${v} !important;`).join('')} }
    body { background-color: ${p.base} !important; isolation: isolate; }
    #codex-wallpaper-local-image { position:fixed; inset:0; z-index:-1; pointer-events:none;
      background-image:${config.image ? `url("${config.image}")` : 'none'};
      background-position:calc(50% + ${horizontalOffset}vw) ${position}%; background-size:cover; background-repeat:no-repeat;
      filter:blur(${blur}px); opacity:${strength}; }
    #root, [data-app-shell-frame], [data-app-shell-main-surface] { background-color:transparent !important; }
    [data-app-shell-left-panel-appearance] { background-color:${p.base}99 !important; }
    [data-app-shell-main-surface] { --app-color-background-surface:transparent !important; }
  `;
  const layer = document.createElement('div');
  layer.id = 'codex-wallpaper-local-image';
  layer.setAttribute('aria-hidden','true');
  document.head.append(style);
  document.body.prepend(layer);
  const bitmap = new Image();
  const resize = () => {
    if (!layer.isConnected || !bitmap.naturalWidth) return;
    const scale = Math.max(layer.clientWidth / bitmap.naturalWidth, layer.clientHeight / bitmap.naturalHeight) * zoom;
    layer.style.backgroundSize = `${bitmap.naturalWidth * scale}px ${bitmap.naturalHeight * scale}px`;
  };
  bitmap.onload = resize;
  if (config.image) bitmap.src = config.image;
  window.addEventListener('resize', resize);
  const runtime = {
    revision: config.revision,
    touched: Date.now(),
    restore() {
      clearInterval(this.timer);
      window.removeEventListener('resize', resize);
      bitmap.onload = null;
      style.remove(); layer.remove();
      if (window[key] === this) delete window[key];
    }
  };
  // A suspended or crashed controller releases the appearance automatically.
  runtime.timer = setInterval(() => {
    if (Date.now() - runtime.touched > 15000) runtime.restore();
  }, 2000);
  window[key] = runtime;
  return { applied: true, image: Boolean(config.image), version: 1 };
})
