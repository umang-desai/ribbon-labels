import { App, Platform, Plugin, PluginSettingTab, Setting } from "obsidian";

type Mode = "always" | "hover";
interface Settings { enabled: boolean; mode: Mode; width: number; maxLines: number }

const DEFAULTS: Settings = { enabled: true, mode: "always", width: 70, maxLines: 2 };

const STYLE_ID = "ribbon-labels-style";
const HOST_CLASS = "ribbon-labels-host";
const LABEL_CLASS = "ribbon-labels-text";
const HOVER_CLASS = "ribbon-labels-hover";

export default class RibbonLabelsPlugin extends Plugin {
  settings: Settings = DEFAULTS;

  async onload() {
    if (Platform.isMobile) return; // no ribbon on mobile

    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addSettingTab(new RibbonLabelsSettingTab(this.app, this));

    this.addCommand({
      id: "toggle-ribbon-labels",
      name: "Toggle ribbon labels",
      callback: async () => {
        this.settings.enabled = !this.settings.enabled;
        await this.saveData(this.settings);
        this.apply();
      },
    });

    this.addCommand({
      id: "toggle-labels-mode",
      name: "Labels: toggle always/hover",
      callback: async () => {
        this.settings.mode = this.settings.mode === "always" ? "hover" : "always";
        await this.saveData(this.settings);
        this.apply();
      },
    });

    this.registerEvent(this.app.workspace.on("layout-change", () => this.apply()));
    this.registerEvent(this.app.workspace.on("css-change", () => this.apply()));
    // @ts-ignore present at runtime
    this.app.workspace.onLayoutReady(() => this.apply());
    this.apply();
  }

  onunload() { this.clear(); }

  private ribbonsEls(): HTMLElement[] {
    const w: any = this.app.workspace;
    const api = [w?.leftRibbon?.containerEl, w?.rightRibbon?.containerEl].filter(Boolean);
    const dom = Array.from(document.querySelectorAll<HTMLElement>(".workspace-ribbon"));
    return Array.from(new Set([...api, ...dom]));
  }

  apply() {
    this.clear();
    if (!this.settings.enabled) return;

    const ribbons = this.ribbonsEls();
    for (const r of ribbons) r.classList.add(HOST_CLASS);
    document.body.classList.toggle(HOVER_CLASS, this.settings.mode === "hover");

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) { style = document.createElement("style"); style.id = STYLE_ID; document.head.appendChild(style); }

    const w = `${this.settings.width}px`;
    const lines = this.settings.maxLines;

    style.textContent = `
      .${HOST_CLASS}{width:${w}!important;min-width:${w}!important;flex:0 0 ${w}!important;overflow:visible!important;}
      .${HOST_CLASS} .clickable-icon,
      .${HOST_CLASS} .side-dock-ribbon-action{
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:4px;position:relative;padding:6px 4px;overflow:visible!important;
      }
      /* disable any legacy ::after labels */
      .${HOST_CLASS} .clickable-icon::after,
      .${HOST_CLASS} .side-dock-ribbon-action::after{content:none!important;}

      .${HOST_CLASS} .${LABEL_CLASS}{
        display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lines};
        max-width:100%;max-height:calc(1.1em * ${lines});
        white-space:normal;overflow:hidden;text-overflow:ellipsis;
        overflow-wrap:anywhere;word-break:break-word;
        text-align:center;font-size:10px;line-height:1.1;color:var(--text-normal,#c9ced6);
        pointer-events:none;
      }
      body.${HOVER_CLASS} .${HOST_CLASS} .${LABEL_CLASS}{opacity:0;transition:opacity 120ms ease;}
      body.${HOVER_CLASS} .${HOST_CLASS} .clickable-icon:hover .${LABEL_CLASS},
      body.${HOVER_CLASS} .${HOST_CLASS} .side-dock-ribbon-action:hover .${LABEL_CLASS}{opacity:1;}
    `;

    // prevent duplicates
    document.querySelectorAll(`.${LABEL_CLASS}`).forEach(n => n.remove());

    const iconSel = `.${HOST_CLASS} .clickable-icon, .${HOST_CLASS} .side-dock-ribbon-action`;
    document.querySelectorAll<HTMLElement>(iconSel).forEach(el => {
      const span = document.createElement("span");
      span.className = LABEL_CLASS;
      span.textContent = el.getAttribute("aria-label") || "";
      el.appendChild(span);
    });
  }

  clear() {
    document.querySelectorAll(`.${LABEL_CLASS}`).forEach(n => n.remove());
    this.ribbonsEls().forEach(r => r.classList.remove(HOST_CLASS));
    const s = document.getElementById(STYLE_ID); if (s) s.remove();
    document.body.classList.remove(HOVER_CLASS);
  }
}

class RibbonLabelsSettingTab extends PluginSettingTab {
  plugin: RibbonLabelsPlugin;
  constructor(app: App, plugin: RibbonLabelsPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Ribbon Labels" });

    new Setting(containerEl)
      .setName("Enable")
      .setDesc("Turn labels on or off")
      .addToggle(t => t.setValue(this.plugin.settings.enabled).onChange(async v => {
        this.plugin.settings.enabled = v; await this.plugin.saveData(this.plugin.settings); this.plugin.apply();
      }));

    new Setting(containerEl)
      .setName("Show mode")
      .setDesc("Always visible or only on hover")
      .addDropdown(d => d.addOptions({ always: "Always", hover: "On hover" })
        .setValue(this.plugin.settings.mode)
        .onChange(async (v: Mode) => { this.plugin.settings.mode = v; await this.plugin.saveData(this.plugin.settings); this.plugin.apply(); })
      );

    new Setting(containerEl)
      .setName("Ribbon width")
      .setDesc("Pixels")
      .addSlider(s => s.setLimits(60, 160, 1)
        .setValue(this.plugin.settings.width)
        .setDynamicTooltip()
        .onChange(async v => { this.plugin.settings.width = v; await this.plugin.saveData(this.plugin.settings); this.plugin.apply(); })
      );

    new Setting(containerEl)
      .setName("Max label lines")
      .setDesc("1–4")
      .addSlider(s => s.setLimits(1, 4, 1)
        .setValue(this.plugin.settings.maxLines)
        .setDynamicTooltip()
        .onChange(async v => { this.plugin.settings.maxLines = v; await this.plugin.saveData(this.plugin.settings); this.plugin.apply(); })
      );
  }
}
