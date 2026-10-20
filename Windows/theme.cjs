const {normalize}=require('./settings.cjs');
const scope='html[data-cw-theme="active"]';
function rgba(hex,alpha){return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;}
function buildCSS(input,image){
 const s=normalize(input),p=s.panel;
 if(image&&!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))throw Error('Unsupported image');
 const glass=(opacity,blur,radius=false)=>`background:linear-gradient(125deg,${rgba('#ffffff',s.glass?s.highlight/250:0)},transparent 48%),${rgba(p,opacity/100)} !important;backdrop-filter:blur(${s.glass?blur:0}px) saturate(135%) !important;border-color:${rgba(s.accent,s.border/100)} !important;box-shadow:inset 0 1px 0 ${rgba('#ffffff',s.glass?s.highlight/100:0)},0 5px 22px ${rgba('#000000',s.shadow/100)} !important;${radius?`border-radius:${s.radius}px !important;`:''}`;
 return `
${scope}{
 color-scheme:${parseInt(s.base.slice(1,3),16)>170?'light':'dark'};
 --color-text:${s.text} !important;--color-text-primary:${s.text} !important;--color-text-secondary:${s.muted} !important;--color-text-tertiary:${s.muted} !important;
 --color-icon:${s.text} !important;--color-icon-secondary:${s.muted} !important;
 --color-surface:${s.base} !important;--color-surface-secondary:${p} !important;--color-surface-elevated:${p} !important;--color-surface-elevated-secondary:${p} !important;
 --app-color-text-foreground:${s.text} !important;--app-color-text-foreground-secondary:${s.muted} !important;
 --app-color-text-accent:${s.accent} !important;--app-color-icon-primary:${s.text} !important;
 --app-color-background-shell:transparent !important;--app-shell-sidebar-background:transparent !important;--app-shell-panel-background:transparent !important;
 --app-color-background-surface:transparent !important;--app-color-background-control:${p} !important;
 --app-color-background-elevated-primary:${p} !important;--app-color-background-elevated-secondary:${p} !important;
 --color-border:${rgba(s.accent,s.border/100)} !important;--color-border-subtle:${rgba(s.accent,s.border/150)} !important;
 --sidebar-row-background-hover:${rgba(s.accent,.12)} !important;--sidebar-row-background-selected:${rgba(s.accent,.22)} !important;
 --sidebar-row-background-active:${rgba(s.accent,.22)} !important;--sidebar-row-border-radius:${Math.min(s.radius,12)}px;
}
${scope},${scope} body{background:${s.base} !important;color:${s.text} !important;}
${scope} #root{background:transparent !important;}
${scope} [data-app-shell-frame]{isolation:isolate;background:${s.base} !important;--app-shell-titlebar-top-inset:0px !important;}
${scope} [data-app-shell-frame]::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:${image?`url("${image}")`:'none'};background-repeat:no-repeat;background-position:calc(50% + ${s.offsetX}vw) ${s.positionY}%;opacity:${s.strength/100};filter:blur(${s.wallpaperBlur}px);}
${scope} :is([data-app-shell-main-surface],[class*="_MainContentSurface_"],[class*="_PageSurface_"],[class*="_MainContentFrame_"],.thread-scroll-container,aside.app-shell-left-panel){background:transparent !important;}
${scope} :is([class*="_FullHeightPageSurfaceLayout_"],[class*="_WorkspaceContent_"])::before{background:transparent !important;}
${scope} aside.app-shell-left-panel{margin-block-start:0 !important;}
${scope} :is([class*="_ApplicationMenuTopBar_"],header[data-app-shell-titlebar]){${glass(s.menuOpacity,s.menuBlur)}color:${s.text} !important;}
${scope} [data-app-navigation-rail]{${glass(s.railOpacity,s.railBlur)}}
${scope} :is([class*="_ConversationSidebar_"],aside.app-shell-left-panel nav[class*="_Navigation_"]){${glass(s.sidebarOpacity,s.sidebarBlur)}color:${s.text} !important;}
${scope} :is([data-app-navigation-rail],[class*="_ConversationSidebar_"]) :is(button,a):hover{background:${rgba(s.accent,.14)} !important;}
${scope} :is([data-app-navigation-rail],[class*="_ConversationSidebar_"]) :is([aria-current="page"],[aria-selected="true"],[data-active="true"]){background:${rgba(s.accent,.22)} !important;box-shadow:inset 2px 0 ${s.accent};}
${scope} [data-thread-find-target="conversation"]{background:transparent !important;color:${s.text} !important;--color-text:${s.text} !important;--color-text-secondary:${s.muted} !important;text-shadow:0 1px 2px ${rgba('#000000',s.textShadow/100)},0 0 4px ${rgba('#000000',s.textShadow/180)};}
${scope} [data-local-conversation-final-assistant]{color:${s.text} !important;}
/* Native thread footer paints a separate opaque backing beneath the composer.
   Clear only this decorative backing, not buttons, menus or interactive rows. */
${scope} [data-thread-scroll-footer] [class*="_background_"][class*="_surface_"],
${scope} [data-thread-scroll-footer] [class*="_background_"][class*="_surface_"]::before,
${scope} [data-thread-scroll-footer] [class*="_background_"][class*="_surface_"]::after{background:transparent !important;box-shadow:none !important;}
${scope} .thread-scroll-container [class*="_background_"][class*="_fade_"]{background:transparent !important;box-shadow:none !important;}
${scope} :is([data-composer-surface-variant][data-composer-radius-variant],.composer-surface-chrome,[class*="_ComposerLayoutRoot_"]){${glass(s.composerOpacity,s.composerBlur,true)}border:1px solid ${rgba(s.accent,s.border/100)} !important;color:${s.text} !important;--color-text:${s.text} !important;--color-text-secondary:${s.muted} !important;}
${scope} :is([class*="_ComposerLayoutBody_"],[class*="_ComposerLayoutFooter_"],[class*="_ComposerFooter_"],[data-composer-surface-variant] [contenteditable="true"]){background:transparent !important;}
${scope} [data-composer-rail][data-composer-rail-placement="above"]{${glass(s.composerOpacity,s.composerBlur)}--color-surface:transparent !important;--color-surface-secondary:transparent !important;--color-surface-elevated-secondary:transparent !important;}
${scope} [class*="--turn-diff-row-padding-y:"]{${glass(s.cardOpacity,s.cardBlur,true)}--color-surface:transparent !important;--color-surface-secondary:transparent !important;--color-surface-elevated-secondary:transparent !important;}
${scope} [class*="--turn-diff-row-padding-y:"] :is([class*="bg-surface"],[class*="bg-background"]){background-color:transparent !important;}
${scope} [data-summary-panel-variant]{${glass(s.cardOpacity,s.cardBlur,true)}--color-surface-elevated-secondary:transparent !important;--color-surface-secondary:transparent !important;color:${s.text} !important;}
${scope} :is([role="menu"],[role="dialog"],[data-radix-popper-content-wrapper]>div){background:${rgba(p,.96)} !important;color:${s.text} !important;border-color:${rgba(s.accent,.25)} !important;}
${scope} pre{background:${rgba(s.base,.92)} !important;text-shadow:none;}
${scope} code{text-shadow:none;}
${scope} :focus-visible{outline-color:${s.accent} !important;}
${scope} ::selection{background:${rgba(s.accent,.4)};}
`;
}
module.exports={buildCSS,rgba};
