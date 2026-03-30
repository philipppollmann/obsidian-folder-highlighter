import {
    App,
    ColorComponent,
    Modal,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TAbstractFile,
    TFile,
    TFolder,
} from "obsidian";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HighlightStyle {
    backgroundColor: string; // hex, e.g. "#ffff00", or "" for none
    textColor: string;        // hex, e.g. "#000000", or "" for none
    isBold: boolean;
    isItalic: boolean;
}

interface ColorPreset {
    name: string;
    style: HighlightStyle;
}

interface FolderHighlighterSettings {
    styles: Record<string, HighlightStyle>; // vault path → style
    presets: ColorPreset[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_STYLE: HighlightStyle = {
    backgroundColor: "#ffff00",
    textColor: "",
    isBold: false,
    isItalic: false,
};

const DEFAULT_SETTINGS: FolderHighlighterSettings = {
    styles: {},
    presets: [],
};

// ─── Color Utilities ──────────────────────────────────────────────────────────

/** Parse hex (#rrggbb, #rgb) or rgb(r,g,b) → "#rrggbb", or null if invalid. */
function parseColor(raw: string): string | null {
    const s = raw.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
        return (
            "#" +
            s[1] + s[1] +
            s[2] + s[2] +
            s[3] + s[3]
        ).toLowerCase();
    }
    const rgb = s.match(
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i
    );
    if (rgb) {
        const [r, g, b] = [+rgb[1], +rgb[2], +rgb[3]];
        if (r <= 255 && g <= 255 && b <= 255) {
            return (
                "#" +
                r.toString(16).padStart(2, "0") +
                g.toString(16).padStart(2, "0") +
                b.toString(16).padStart(2, "0")
            );
        }
    }
    return null;
}

/** "#rrggbb" → "rgb(r, g, b)" */
function hexToRgbString(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
}

/** Escape a path for use in a CSS attribute selector. */
function escapeCssAttr(path: string): string {
    return path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ─── Style Manager ────────────────────────────────────────────────────────────

class StyleManager {
    private styleEl: HTMLStyleElement;

    constructor() {
        this.styleEl = document.createElement("style");
        this.styleEl.id = "folder-highlighter-styles";
        document.head.appendChild(this.styleEl);
    }

    /** Rebuild the full <style> block from all stored styles. */
    rebuild(styles: Record<string, HighlightStyle>): void {
        const rules: string[] = [];

        for (const [path, style] of Object.entries(styles)) {
            const escaped = escapeCssAttr(path);

            // Target the *inner* content span so only the text is highlighted
            const folderSel = `.nav-folder-title[data-path="${escaped}"] .nav-folder-title-content`;
            const fileSel   = `.nav-file-title[data-path="${escaped}"] .nav-file-title-content`;

            const declarations = buildDeclarations(style);
            if (declarations.length === 0) continue;

            const decl = declarations.join("; ");
            rules.push(`${folderSel}, ${fileSel} { ${decl}; }`);
        }

        this.styleEl.textContent = rules.join("\n");
    }

    destroy(): void {
        this.styleEl.remove();
    }
}

function buildDeclarations(style: HighlightStyle): string[] {
    const decl: string[] = [];
    if (style.backgroundColor) {
        decl.push(`background-color: ${style.backgroundColor} !important`);
        decl.push(`border-radius: 3px !important`);
        decl.push(`padding: 0 3px !important`);
    }
    if (style.textColor) {
        decl.push(`color: ${style.textColor} !important`);
    }
    if (style.isBold)   decl.push(`font-weight: bold !important`);
    if (style.isItalic) decl.push(`font-style: italic !important`);
    return decl;
}

// ─── Color Input Row Helper ───────────────────────────────────────────────────

/** Creates a colour-picker + text input pair.
 *  The text input accepts #rrggbb, #rgb, or rgb(r,g,b).
 *  Returns { container, getValue, setValue }. */
function createColorRow(
    parent: HTMLElement,
    label: string,
    initial: string,
    onChange: (hex: string) => void
): { getValue: () => string; setValue: (hex: string) => void } {
    const row = parent.createDiv({ cls: "cfh-color-row" });
    row.createEl("span", { cls: "cfh-color-label", text: label });

    const controls = row.createDiv({ cls: "cfh-color-controls" });

    // Native colour picker (ColorComponent)
    const pickerWrap = controls.createDiv({ cls: "cfh-picker-wrap" });
    let picker: ColorComponent | null = null;
    // ColorComponent requires a container element
    picker = new ColorComponent(pickerWrap);
    if (initial) picker.setValue(initial);

    // Text input (hex or rgb)
    const textInput = controls.createEl("input", {
        cls: "cfh-color-input",
        type: "text",
        placeholder: "#rrggbb or rgb(…)",
        value: initial,
    });

    // Clear button
    const clearBtn = controls.createEl("button", { cls: "cfh-clear-btn", text: "✕" });
    clearBtn.title = "Remove colour";

    // Sync picker → text
    picker.onChange((hex) => {
        textInput.value = hex;
        onChange(hex);
    });

    // Sync text → picker
    textInput.addEventListener("input", () => {
        const parsed = parseColor(textInput.value);
        if (parsed) {
            picker!.setValue(parsed);
            textInput.classList.remove("cfh-input-error");
            onChange(parsed);
        } else if (textInput.value === "") {
            textInput.classList.remove("cfh-input-error");
            onChange("");
        } else {
            textInput.classList.add("cfh-input-error");
        }
    });

    // Blur: normalise display to hex
    textInput.addEventListener("blur", () => {
        const parsed = parseColor(textInput.value);
        if (parsed) textInput.value = parsed;
    });

    clearBtn.addEventListener("click", () => {
        textInput.value = "";
        textInput.classList.remove("cfh-input-error");
        onChange("");
    });

    return {
        getValue: () => parseColor(textInput.value) ?? "",
        setValue: (hex: string) => {
            textInput.value = hex;
            if (hex) picker!.setValue(hex);
        },
    };
}

// ─── Highlight Modal ──────────────────────────────────────────────────────────

class HighlightModal extends Modal {
    private file: TAbstractFile;
    private plugin: FolderHighlighterPlugin;
    private current: HighlightStyle;

    // live references so we can push preset values
    private bgRow!: { getValue: () => string; setValue: (h: string) => void };
    private fgRow!: { getValue: () => string; setValue: (h: string) => void };
    private boldToggle!: HTMLInputElement;
    private italicToggle!: HTMLInputElement;
    private previewEl!: HTMLElement;

    constructor(app: App, plugin: FolderHighlighterPlugin, file: TAbstractFile) {
        super(app);
        this.plugin = plugin;
        this.file = file;
        this.current = Object.assign(
            {},
            DEFAULT_STYLE,
            plugin.settings.styles[file.path] ?? {}
        );
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("cfh-modal");
        contentEl.createEl("h4", {
            text: `Highlight: ${this.file.name}`,
            cls: "cfh-modal-title",
        });

        // ── Preview ──────────────────────────────────────────────────────────
        const previewWrap = contentEl.createDiv({ cls: "cfh-preview-wrap" });
        previewWrap.createEl("span", { text: "Preview", cls: "cfh-section-label" });
        this.previewEl = previewWrap.createDiv({ cls: "cfh-preview" });
        this.previewEl.createEl("span", {
            cls: "cfh-preview-icon",
            text: this.file instanceof TFolder ? "📁" : "📄",
        });
        this.previewEl.createEl("span", {
            cls: "cfh-preview-text",
            text: this.file.name,
        });
        this.refreshPreview();

        // ── Background colour ─────────────────────────────────────────────────
        contentEl.createEl("span", { text: "Background colour", cls: "cfh-section-label" });
        this.bgRow = createColorRow(contentEl, "", this.current.backgroundColor, (hex) => {
            this.current.backgroundColor = hex;
            this.refreshPreview();
        });

        // ── Text colour ────────────────────────────────────────────────────────
        contentEl.createEl("span", { text: "Text colour", cls: "cfh-section-label" });
        this.fgRow = createColorRow(contentEl, "", this.current.textColor, (hex) => {
            this.current.textColor = hex;
            this.refreshPreview();
        });

        // ── Typography ────────────────────────────────────────────────────────
        const typoRow = contentEl.createDiv({ cls: "cfh-typo-row" });
        this.boldToggle   = this.createToggle(typoRow, "Bold",   this.current.isBold,   (v) => { this.current.isBold   = v; this.refreshPreview(); });
        this.italicToggle = this.createToggle(typoRow, "Italic", this.current.isItalic, (v) => { this.current.isItalic = v; this.refreshPreview(); });

        // ── Presets ───────────────────────────────────────────────────────────
        this.buildPresetsSection(contentEl);

        // ── Buttons ───────────────────────────────────────────────────────────
        const btnRow = contentEl.createDiv({ cls: "cfh-btn-row" });

        const removeBtn = btnRow.createEl("button", { text: "Remove", cls: "cfh-btn cfh-btn-danger" });
        removeBtn.addEventListener("click", async () => {
            delete this.plugin.settings.styles[this.file.path];
            await this.plugin.saveSettings();
            this.close();
        });

        const applyBtn = btnRow.createEl("button", { text: "Apply", cls: "cfh-btn cfh-btn-primary" });
        applyBtn.addEventListener("click", async () => {
            this.plugin.settings.styles[this.file.path] = { ...this.current };
            await this.plugin.saveSettings();
            this.close();
        });

        const closeBtn = btnRow.createEl("button", { text: "Close", cls: "cfh-btn" });
        closeBtn.addEventListener("click", () => this.close());
    }

    private createToggle(
        parent: HTMLElement,
        label: string,
        initial: boolean,
        onChange: (v: boolean) => void
    ): HTMLInputElement {
        const wrap = parent.createDiv({ cls: "cfh-toggle-wrap" });
        const cb = wrap.createEl("input", { type: "checkbox" });
        cb.checked = initial;
        wrap.createEl("label", { text: label });
        cb.addEventListener("change", () => onChange(cb.checked));
        return cb;
    }

    private buildPresetsSection(parent: HTMLElement): void {
        const section = parent.createDiv({ cls: "cfh-presets-section" });
        section.createEl("span", { text: "Presets", cls: "cfh-section-label" });

        const presetsRow = section.createDiv({ cls: "cfh-presets-row" });

        // Dropdown to load a preset
        const select = presetsRow.createEl("select", { cls: "cfh-preset-select" });
        const placeholder = select.createEl("option", { text: "— load preset —", value: "" });
        placeholder.disabled = true;
        placeholder.selected = true;

        const rebuildOptions = () => {
            // Remove existing non-placeholder options
            Array.from(select.options).slice(1).forEach((o) => o.remove());
            for (const p of this.plugin.settings.presets) {
                select.createEl("option", { text: p.name, value: p.name });
            }
        };
        rebuildOptions();

        select.addEventListener("change", () => {
            const preset = this.plugin.settings.presets.find((p) => p.name === select.value);
            if (preset) {
                this.current = { ...preset.style };
                this.bgRow.setValue(this.current.backgroundColor);
                this.fgRow.setValue(this.current.textColor);
                this.boldToggle.checked   = this.current.isBold;
                this.italicToggle.checked = this.current.isItalic;
                this.refreshPreview();
            }
            select.value = "";
        });

        // Save current as preset
        const saveRow = section.createDiv({ cls: "cfh-preset-save-row" });
        const nameInput = saveRow.createEl("input", {
            type: "text",
            placeholder: "Preset name…",
            cls: "cfh-preset-name-input",
        });
        const saveBtn = saveRow.createEl("button", { text: "Save preset", cls: "cfh-btn" });
        saveBtn.addEventListener("click", async () => {
            const name = nameInput.value.trim();
            if (!name) { new Notice("Enter a name for the preset."); return; }
            const existing = this.plugin.settings.presets.findIndex((p) => p.name === name);
            const preset: ColorPreset = { name, style: { ...this.current } };
            if (existing >= 0) {
                this.plugin.settings.presets[existing] = preset;
            } else {
                this.plugin.settings.presets.push(preset);
            }
            await this.plugin.saveSettings();
            new Notice(`Preset "${name}" saved.`);
            nameInput.value = "";
            rebuildOptions();
        });
    }

    private refreshPreview(): void {
        const textEl = this.previewEl.querySelector<HTMLElement>(".cfh-preview-text");
        if (!textEl) return;
        textEl.style.backgroundColor = this.current.backgroundColor || "";
        textEl.style.color            = this.current.textColor || "";
        textEl.style.fontWeight       = this.current.isBold   ? "bold"   : "";
        textEl.style.fontStyle        = this.current.isItalic ? "italic" : "";
        textEl.style.borderRadius     = this.current.backgroundColor ? "3px" : "";
        textEl.style.padding          = this.current.backgroundColor ? "0 3px" : "";
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class FolderHighlighterSettingTab extends PluginSettingTab {
    plugin: FolderHighlighterPlugin;

    constructor(app: App, plugin: FolderHighlighterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Folder Highlighter" });

        // ── Presets as code ───────────────────────────────────────────────────
        containerEl.createEl("h3", { text: "Presets (as code)" });
        containerEl.createEl("p", {
            cls: "cfh-settings-hint",
            text: 'Edit the JSON below to manage presets. Each entry needs "name", "backgroundColor", "textColor", "isBold", "isItalic".',
        });

        const textarea = containerEl.createEl("textarea", { cls: "cfh-presets-json" });
        textarea.rows = 12;
        textarea.value = JSON.stringify(this.plugin.settings.presets, null, 2);

        const saveRow = containerEl.createDiv({ cls: "cfh-settings-save-row" });
        const saveBtn = saveRow.createEl("button", { text: "Save presets", cls: "mod-cta" });
        const statusEl = saveRow.createEl("span", { cls: "cfh-save-status" });

        saveBtn.addEventListener("click", async () => {
            try {
                const parsed = JSON.parse(textarea.value) as ColorPreset[];
                if (!Array.isArray(parsed)) throw new Error("Must be a JSON array");
                // Validate each entry
                for (const p of parsed) {
                    if (typeof p.name !== "string") throw new Error(`Entry missing "name"`);
                    if (p.style.backgroundColor !== "" && p.style.backgroundColor && !parseColor(p.style.backgroundColor)) {
                        throw new Error(`Invalid backgroundColor in preset "${p.name}"`);
                    }
                }
                this.plugin.settings.presets = parsed;
                await this.plugin.saveSettings();
                statusEl.textContent = "Saved.";
                statusEl.style.color = "var(--color-green)";
                setTimeout(() => (statusEl.textContent = ""), 2000);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                statusEl.textContent = `Error: ${msg}`;
                statusEl.style.color = "var(--color-red)";
            }
        });

        // ── Active highlights overview ────────────────────────────────────────
        containerEl.createEl("h3", { text: "Active highlights" });

        const paths = Object.keys(this.plugin.settings.styles);
        if (paths.length === 0) {
            containerEl.createEl("p", { text: "No highlights set yet. Right-click a folder or file in the explorer." });
        } else {
            for (const path of paths) {
                const style = this.plugin.settings.styles[path];
                new Setting(containerEl)
                    .setName(path)
                    .setDesc(
                        `bg: ${style.backgroundColor || "none"}  fg: ${style.textColor || "none"}` +
                        (style.isBold ? "  bold" : "") +
                        (style.isItalic ? "  italic" : "")
                    )
                    .addButton((btn) =>
                        btn
                            .setButtonText("Remove")
                            .setWarning()
                            .onClick(async () => {
                                delete this.plugin.settings.styles[path];
                                await this.plugin.saveSettings();
                                this.display();
                            })
                    );
            }
        }
    }
}

// ─── Main Plugin ──────────────────────────────────────────────────────────────

export default class FolderHighlighterPlugin extends Plugin {
    settings: FolderHighlighterSettings = DEFAULT_SETTINGS;
    private styleManager!: StyleManager;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.styleManager = new StyleManager();
        this.styleManager.rebuild(this.settings.styles);

        // Right-click context menu
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file: TAbstractFile) => {
                menu.addItem((item) => {
                    item
                        .setTitle("Highlight appearance")
                        .setIcon("palette")
                        .onClick(() => {
                            new HighlightModal(this.app, this, file).open();
                        });
                });
            })
        );

        this.addSettingTab(new FolderHighlighterSettingTab(this.app, this));
    }

    onunload(): void {
        this.styleManager.destroy();
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.styleManager.rebuild(this.settings.styles);
    }
}
