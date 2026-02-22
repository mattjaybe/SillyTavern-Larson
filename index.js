// Larson Extension - AI processing indicator bar for SillyTavern
// Uses jQuery for DOM manipulation when available.
(function () {
    console.log('[Larson] JS Updated v4 - Mobile Fixes Active');
    'use strict';

    if (window.larson_cleanup) {
        try { window.larson_cleanup(); } catch (e) { console.error('Larson cleanup failed:', e); }
    }

    const MODULE_NAME = 'larson';
    const EXTENSION_NAME = 'Larson';
    const DEBUG = true; // Temporarily enable for mobile debugging
    const $ = (typeof window.jQuery !== 'undefined' && window.jQuery) ? window.jQuery : null;

    let BASE_URL = '';
    const scripts = document.querySelectorAll('script[src*="index.js"]');
    for (const script of scripts) {
        const src = script.src || '';
        if (src.includes('SillyTavern-Larson') || src.includes('/Larson/') || src.includes('\\Larson\\')) {
            BASE_URL = src.split('/').slice(0, -1).join('/');
            break;
        }
    }
    if (!BASE_URL) {
        BASE_URL = '/scripts/extensions/third-party/SillyTavern-Larson';
    }

    // Built-in themes: triadic palettes (3 colors each). User theme resolved at runtime from ST CSS vars.
    // Built-in themes: triadic palettes (3 colors each). User theme resolved at runtime from ST CSS vars.
    // Updated to High Contrast / Neon palettes (Dark -> Neon -> Bright)
    const BUILT_IN_THEMES = Object.freeze([
        { id: 'sillytavern', name: 'SillyTavern', colors: null },
        { id: 'default', name: 'Purple', colors: ['#240046', '#9D00FF', '#E0B0FF', '#FF69B4'] },
        { id: 'ocean', name: 'Ocean', colors: ['#001133', '#0088FF', '#00FFFF', '#7FFFD4'] },
        { id: 'sunset', name: 'Sunset', colors: ['#4A0E00', '#FF4500', '#FFD700', '#FF8C00'] },
        { id: 'forest', name: 'Forest', colors: ['#002200', '#00FF41', '#CCFF00', '#32CD32'] },
        { id: 'mono', name: 'Mono', colors: ['#000000', '#808080', '#FFFFFF', '#C0C0C0'] },
        { id: 'synthwave', name: 'Synthwave', colors: ['#2E003E', '#FF00FF', '#00F3FF', '#FF1493'] },
        { id: 'rose', name: 'Rose', colors: ['#330000', '#FF0040', '#FFB6C1', '#FF69B4'] },
        { id: 'metal', name: 'Metal', colors: ['#1a1a1a', '#d4af37', '#c0c0c0', '#b87333'] },
    ]);

    const ANIMATION_STYLES = Object.freeze(['gradient', 'breathe', 'cylon', 'segment', 'glitch', 'liquid', 'convergence']);

    // Thinking/reasoning tag patterns for cross-LLM compatibility
    const THINKING_OPEN_TAGS = ['<thinking>', '<think>', '<reasoning>', '<reason>', '<thought>'];
    const THINKING_CLOSE_TAGS = ['</thinking>', '</think>', '</reasoning>', '</reason>', '</thought>'];

    const defaultSettings = Object.freeze({
        enabled: true,
        bar_height: 'default',
        animation_style: 'gradient',
        animation_speed: 'normal',
        theme: 'sillytavern',
        customThemes: [],
        idle_animation_enabled: false,
        idle_animation_style: 'breathe',
        idle_animation_speed: 'normal',
        thinking_animation_enabled: false,
        thinking_animation_style: 'gradient',
        thinking_animation_speed: 'normal',
    });

    let settings = JSON.parse(JSON.stringify(defaultSettings));
    let barEl = null;
    let overlayEl = null;
    let dropdownEl = null;
    let editingCustomThemeId = null;
    var lastGenerationEndedAt = 0;
    var dropdownReady = false;
    var optionsModalEscapeHandler = null;
    var explicitUserGeneration = false;
    var lastUserAction = 0;
    var extensionReadyAt = 0;
    var suppressedLoadGenerationStart = false;
    var isInThinkingBlock = false;       // Track whether we're inside LLM thinking/reasoning tags
    var hasReceivedRealContent = false;  // Track whether we've received actual (non-thinking) content
    var tokenBuffer = '';                 // Buffer to catch tags split across tokens

    var optionsModalEscapeHandler = null;

    function closeOptionsModal() {
        if (!overlayEl || !overlayEl.parentNode) return;
        document.removeEventListener('click', closeDropdownOnClick);
        document.removeEventListener('touchend', closeDropdownOnClick);
        if (optionsModalEscapeHandler) {
            document.removeEventListener('keydown', optionsModalEscapeHandler);
            optionsModalEscapeHandler = null;
        }
        overlayEl.classList.remove('larson_options_overlay_open');
        overlayEl.remove();
        if (barEl) barEl.setAttribute('title', 'Click to open Larson options');
    }

    function log(...args) { if (DEBUG) console.log(`[${EXTENSION_NAME}]`, ...args); }
    function warn(...args) { console.warn(`[${EXTENSION_NAME}]`, ...args); }
    function error(...args) { console.error(`[${EXTENSION_NAME}]`, ...args); }

    function getContext() {
        try {
            return (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
        } catch (e) {
            return null;
        }
    }

    function getSettings() {
        const ctx = getContext();
        if (!ctx || !ctx.extensionSettings) return Object.assign({}, defaultSettings);
        if (!ctx.extensionSettings[MODULE_NAME]) {
            ctx.extensionSettings[MODULE_NAME] = JSON.parse(JSON.stringify(defaultSettings));
        }
        const s = ctx.extensionSettings[MODULE_NAME];
        if (!Array.isArray(s.customThemes)) s.customThemes = [];
        for (const key of Object.keys(defaultSettings)) {
            if (!Object.hasOwn(s, key)) s[key] = defaultSettings[key];
        }
        // Migrate old state_aware_animation to thinking_animation_enabled
        if (Object.hasOwn(s, 'state_aware_animation')) {
            s.thinking_animation_enabled = !!s.state_aware_animation;
            delete s.state_aware_animation;
        }
        // Migrate old 'user' theme to 'sillytavern'
        if (s.theme === 'user') {
            s.theme = 'sillytavern';
        }
        // Migrate old single custom theme (custom_color_a, custom_color_b) to new triadic custom theme
        if (s.theme === 'custom' && (s.custom_color_a || s.custom_color_b)) {
            const a = (s.custom_color_a || '#7c3aed').trim();
            const b = (s.custom_color_b || '#a855f7').trim();
            const id = 'custom-' + Date.now();
            s.customThemes.push({ id, name: 'My custom', colors: [a, b, b, b] });
            s.theme = id;
            delete s.custom_color_a;
            delete s.custom_color_b;
        }
        // Migrate 3-color custom themes to 4-color themes
        if (Array.isArray(s.customThemes)) {
            s.customThemes.forEach(theme => {
                if (Array.isArray(theme.colors) && theme.colors.length === 3) {
                    // Add a fourth color derived from the third color (slightly lighter/different)
                    theme.colors.push(theme.colors[2]);
                }
            });
        }
        return ctx.extensionSettings[MODULE_NAME];
    }

    function saveSettings() {
        const ctx = getContext();
        if (ctx && ctx.saveSettingsDebounced) ctx.saveSettingsDebounced();
        applySettingsToUI();
    }

    function loadSettings() {
        settings = getSettings();
        log('Settings loaded, enabled:', settings.enabled);
    }

    function getUserThemeColors() {
        try {
            const root = document.documentElement;
            const style = root && window.getComputedStyle ? getComputedStyle(root) : null;
            if (!style) return ['#0f141c', '#7c3aed', '#e6f0ff', '#a855f7']; // Fallback

            // Color A (Dark/Shadow/Trail): SmartThemeBlurTintColor (Dark background)
            const colorA = (style.getPropertyValue('--SmartThemeBlurTintColor') || '#0f141c').trim();

            // Color B (Neon/Main): SmartThemeQuoteColor (Mint/Accent) or EmColor
            // Quote color is typically the main accent in ST themes.
            const colorB = (style.getPropertyValue('--SmartThemeQuoteColor') || '#7c3aed').trim();

            // Color C (Bright/Highlight): SmartThemeBodyColor (Text/Foreground)
            const colorC = (style.getPropertyValue('--SmartThemeBodyColor') || '#e6f0ff').trim();

            // Color D (Accent/Secondary): SmartThemeEmColor (Emphasis color)
            const colorD = (style.getPropertyValue('--SmartThemeEmColor') || '#a855f7').trim();

            return [colorA, colorB, colorC, colorD];
        } catch (e) {
            return ['#0f141c', '#7c3aed', '#e6f0ff', '#a855f7'];
        }
    }

    function getThemeById(id) {
        if (!id) return null;
        const built = BUILT_IN_THEMES.find(t => t.id === id);
        if (built) {
            let colors = built.id === 'sillytavern' ? getUserThemeColors() : (built.colors || []);
            return { id: built.id, name: built.name, colors: colors };
        }
        const custom = (getSettings().customThemes || []).find(t => t.id === id);
        return custom ? { id: custom.id, name: custom.name, colors: custom.colors || [] } : null;
    }

    function getAllThemes() {
        const list = BUILT_IN_THEMES.map(t => {
            var colors = t.id === 'sillytavern' ? getUserThemeColors() : (t.colors || []);
            return { id: t.id, name: t.name, colors: colors };
        });
        (getSettings().customThemes || []).forEach(ct => {
            list.push({ id: ct.id, name: ct.name, colors: ct.colors || [] });
        });
        return list;
    }

    function applyBarStyles() {
        if (!barEl) return;
        const s = getSettings();

        barEl.classList.toggle('larson_enabled', !!s.enabled);
        if (barEl.parentNode && barEl.parentNode.classList.contains('larson_bar_container')) {
            barEl.parentNode.classList.toggle('larson_enabled', !!s.enabled);
        }
        barEl.classList.remove('larson_height_compact', 'larson_height_default', 'larson_height_tall');
        barEl.classList.add('larson_height_' + (s.bar_height || 'default'));

        barEl.classList.remove('larson_style_gradient', 'larson_style_breathe', 'larson_style_cylon', 'larson_style_segment', 'larson_style_glitch', 'larson_style_liquid', 'larson_style_convergence');
        barEl.classList.add('larson_style_' + (s.animation_style || 'gradient'));

        barEl.classList.remove('larson_idle_static');
        ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_idle_style_' + st));
        if (!!s.enabled && !barEl.classList.contains('larson_processing')) {
            if (s.idle_animation_enabled && s.idle_animation_style) {
                barEl.classList.add('larson_idle_style_' + (ANIMATION_STYLES.includes(s.idle_animation_style) ? s.idle_animation_style : 'pulse'));
            } else {
                barEl.classList.add('larson_idle_static');
            }
        }

        ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_thinking_style_' + st));
        if (barEl.classList.contains('larson_processing') && barEl.classList.contains('larson_thinking') && s.thinking_animation_enabled && s.thinking_animation_style) {
            barEl.classList.add('larson_thinking_style_' + (ANIMATION_STYLES.includes(s.thinking_animation_style) ? s.thinking_animation_style : 'shimmer'));
        }

        // Hide when idle setting
        barEl.classList.toggle('larson_hide_idle', !!s.hide_when_idle);

        // Apply distinct speed classes for CSS handling
        barEl.classList.remove(
            'larson_speed_slow', 'larson_speed_normal', 'larson_speed_fast',
            'larson_idle_speed_slow', 'larson_idle_speed_normal', 'larson_idle_speed_fast',
            'larson_thinking_speed_slow', 'larson_thinking_speed_normal', 'larson_thinking_speed_fast',
            'larson_gen_speed_slow', 'larson_gen_speed_normal', 'larson_gen_speed_fast'
        );

        // We apply specific speed classes based on settings, CSS will match them with state
        barEl.classList.add('larson_gen_speed_' + (s.animation_speed || 'normal'));
        barEl.classList.add('larson_idle_speed_' + (s.idle_animation_speed || 'normal'));
        barEl.classList.add('larson_thinking_speed_' + (s.thinking_animation_speed || 'normal'));

        const themeId = s.theme || 'sillytavern';
        const theme = getThemeById(themeId);
        barEl.classList.remove('larson_theme_sillytavern', 'larson_theme_default', 'larson_theme_ocean', 'larson_theme_sunset', 'larson_theme_forest', 'larson_theme_mono', 'larson_theme_synthwave', 'larson_theme_rose', 'larson_theme_metal', 'larson_theme_custom');
        const isBuiltIn = BUILT_IN_THEMES.some(t => t.id === themeId);
        if (isBuiltIn) {
            barEl.classList.add('larson_theme_' + themeId);
        } else {
            barEl.classList.add('larson_theme_custom');
        }
        if (theme && theme.colors && theme.colors.length >= 3) {
            barEl.style.setProperty('--larson-color-a', theme.colors[0]);
            barEl.style.setProperty('--larson-color-b', theme.colors[1]);
            barEl.style.setProperty('--larson-color-c', theme.colors[2]);
            if (theme.colors.length >= 4) {
                barEl.style.setProperty('--larson-color-d', theme.colors[3]);
            } else {
                barEl.style.removeProperty('--larson-color-d');
            }
            // Use Color 2 (Neon) for glow if available, otherwise Color 1
            const glowSource = theme.colors[1] || theme.colors[0];
            const glowRgba = hexToRgba(glowSource, 0.5);
            barEl.style.setProperty('--larson-glow', glowRgba);
        } else {
            barEl.style.removeProperty('--larson-color-a');
            barEl.style.removeProperty('--larson-color-b');
            barEl.style.removeProperty('--larson-color-c');
            barEl.style.removeProperty('--larson-color-d');
            barEl.style.removeProperty('--larson-glow');
        }
        log('applyBarStyles applied. Current classes:', barEl.className);
    }

    // Refresh SillyTavern theme colors when the user changes their ST theme
    function refreshSillyTavernTheme() {
        const s = getSettings();

        // Only refresh active bar if currently using SillyTavern theme
        if (s.theme === 'sillytavern') {
            log('Refreshing SillyTavern theme colors');
            // Re-apply bar styles which will fetch latest colors from getUserThemeColors()
            applyBarStyles();
        }

        // Rebuild dropdown themes if modal is open
        if (typeof window.larson_refreshThemeSelect === 'function') {
            window.larson_refreshThemeSelect();
        }

        // Update all preview bars in the dropdown
        if (overlayEl && overlayEl.classList.contains('larson_options_overlay_open')) {
            const themeGrid = dropdownEl ? dropdownEl.querySelector('.larson_theme_grid') : null;
            if (themeGrid) {
                const sillyTavernRow = Array.from(themeGrid.querySelectorAll('.larson_theme_swatch_row'))
                    .find(row => row.dataset.theme === 'sillytavern');
                if (sillyTavernRow) {
                    const previewBar = sillyTavernRow.querySelector('.larson_theme_preview_bar');
                    if (previewBar) {
                        const colors = getUserThemeColors();
                        previewBar.style.setProperty('--larson-color-a', colors[0]);
                        previewBar.style.setProperty('--larson-color-b', colors[1]);
                        previewBar.style.setProperty('--larson-color-c', colors[2]);
                        if (colors.length >= 4) {
                            previewBar.style.setProperty('--larson-color-d', colors[3]);
                        }
                        previewBar.style.setProperty('--larson-glow', hexToRgba(colors[1], 0.5));
                    }
                }
            }
        }
    }

    function findInsertTarget() {
        var sendForm = document.getElementById('send_form');
        if (sendForm && sendForm.parentNode) return { parent: sendForm.parentNode, before: sendForm };
        var formSheld = document.getElementById('form_sheld');
        if (formSheld) return { parent: formSheld, before: formSheld.firstChild };
        var textarea = document.getElementById('send_textarea');
        if (textarea && textarea.parentNode) {
            var wrap = textarea.closest('form') || textarea.parentNode;
            return { parent: wrap.parentNode || document.body, before: wrap };
        }
        return null;
    }

    function createThemeModal() {
        var existing = document.getElementById('larson_theme_modal_overlay');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'larson_theme_modal_overlay';
        overlay.className = 'larson_theme_modal_overlay';
        overlay.innerHTML = `
            <div id="larson_theme_modal" class="larson_theme_modal">
                <div class="larson_theme_modal_header">
                    <div id="larson_theme_modal_title" class="larson_theme_modal_title">Create Custom Theme</div>
                    <div id="larson_theme_modal_close_btn" class="larson_modal_close_btn" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </div>
                </div>
                
                <!-- Live Preview Container -->
                <div class="larson_theme_preview_container">
                    <div id="larson_theme_preview_bar" class="larson_bar larson_processing larson_style_gradient larson_speed_normal" style="visibility:visible !important; opacity:1 !important; display:block;"></div>
                </div>

                <!-- Theme Name Row with Randomize -->
                <div class="larson_theme_name_row">
                    <div class="larson_theme_name_group">
                        <label>Theme Name</label>
                        <input type="text" id="larson_theme_modal_name" placeholder="My Custom Theme" maxlength="40">
                    </div>
                    <button type="button" id="larson_randomize_colors" class="larson_randomize_btn" title="Randomize Colors">
                        <i class="fa-solid fa-shuffle"></i>
                    </button>
                </div>

                <!-- Advanced Mode Toggle -->
                <div class="larson_theme_advanced_toggle">
                    <label>
                        <span>Show Hex Inputs</span>
                        <label class="larson_toggle_switch">
                            <input type="checkbox" id="larson_theme_advanced_toggle">
                            <span class="larson_toggle_slider"></span>
                        </label>
                    </label>
                </div>

                <!-- 4-Column Color Grid -->
                <div class="larson_theme_color_columns">
                    <div class="larson_color_column">
                        <label class="larson_color_label">Background</label>
                        <button type="button" class="larson_color_swatch" id="larson_swatch_c1" style="background: #240046;">
                            <input type="color" id="larson_theme_modal_c1" value="#240046" style="opacity: 0; position: absolute; pointer-events: none;">
                        </button>
                        <input type="text" id="larson_theme_hex_c1" class="larson_hex_input larson_hex_advanced" placeholder="#240046" maxlength="7" style="display: none;">
                    </div>
                    <div class="larson_color_column">
                        <label class="larson_color_label">Main Glow</label>
                        <button type="button" class="larson_color_swatch" id="larson_swatch_c2" style="background: #9D00FF;">
                            <input type="color" id="larson_theme_modal_c2" value="#9D00FF" style="opacity: 0; position: absolute; pointer-events: none;">
                        </button>
                        <input type="text" id="larson_theme_hex_c2" class="larson_hex_input larson_hex_advanced" placeholder="#9D00FF" maxlength="7" style="display: none;">
                    </div>
                    <div class="larson_color_column">
                        <label class="larson_color_label">Highlight</label>
                        <button type="button" class="larson_color_swatch" id="larson_swatch_c3" style="background: #E0B0FF;">
                            <input type="color" id="larson_theme_modal_c3" value="#E0B0FF" style="opacity: 0; position: absolute; pointer-events: none;">
                        </button>
                        <input type="text" id="larson_theme_hex_c3" class="larson_hex_input larson_hex_advanced" placeholder="#E0B0FF" maxlength="7" style="display: none;">
                    </div>
                    <div class="larson_color_column">
                        <label class="larson_color_label">Accent</label>
                        <button type="button" class="larson_color_swatch" id="larson_swatch_c4" style="background: #FF69B4;">
                            <input type="color" id="larson_theme_modal_c4" value="#FF69B4" style="opacity: 0; position: absolute; pointer-events: none;">
                        </button>
                        <input type="text" id="larson_theme_hex_c4" class="larson_hex_input larson_hex_advanced" placeholder="#FF69B4" maxlength="7" style="display: none;">
                    </div>
                </div>
                
                <div class="larson_theme_modal_actions">
                    <button type="button" id="larson_theme_modal_cancel" class="larson_modal_secondary">Cancel</button>
                    <button type="button" id="larson_theme_modal_save" class="larson_modal_primary">Save Theme</button>
                </div>
            </div>
        `;
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.classList.remove('active');
        });
        document.body.appendChild(overlay);

        const modal = document.getElementById('larson_theme_modal');
        const titleEl = document.getElementById('larson_theme_modal_title');
        const closeBtn = document.getElementById('larson_theme_modal_close_btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                overlay.classList.remove('active');
                editingCustomThemeId = null;
            });
        }
        const nameInput = document.getElementById('larson_theme_modal_name');
        const previewBar = document.getElementById('larson_theme_preview_bar');
        const cancel = document.getElementById('larson_theme_modal_cancel');
        const save = document.getElementById('larson_theme_modal_save');
        const advancedToggle = document.getElementById('larson_theme_advanced_toggle');
        const randomizeBtn = document.getElementById('larson_randomize_colors');

        const c1 = document.getElementById('larson_theme_modal_c1');
        const c2 = document.getElementById('larson_theme_modal_c2');
        const c3 = document.getElementById('larson_theme_modal_c3');
        const c4 = document.getElementById('larson_theme_modal_c4');

        const hex1 = document.getElementById('larson_theme_hex_c1');
        const hex2 = document.getElementById('larson_theme_hex_c2');
        const hex3 = document.getElementById('larson_theme_hex_c3');
        const hex4 = document.getElementById('larson_theme_hex_c4');

        const swatch1 = document.getElementById('larson_swatch_c1');
        const swatch2 = document.getElementById('larson_swatch_c2');
        const swatch3 = document.getElementById('larson_swatch_c3');
        const swatch4 = document.getElementById('larson_swatch_c4');

        function isValidHex(hex) {
            return /^#[0-9A-Fa-f]{6}$/.test(hex);
        }

        function randomHex() {
            return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
        }

        function updatePreview() {
            if (!previewBar) return;
            previewBar.style.setProperty('--larson-color-a', c1.value);
            previewBar.style.setProperty('--larson-color-b', c2.value);
            previewBar.style.setProperty('--larson-color-c', c3.value);
            previewBar.style.setProperty('--larson-color-d', c4.value);
            previewBar.style.setProperty('--larson-glow', hexToRgba(c2.value, 0.5));
        }

        function syncSwatchBackground(colorInput, swatch) {
            if (swatch && colorInput) {
                swatch.style.background = colorInput.value;
            }
        }

        function syncHexToColor(hexInput, colorInput, swatch) {
            const hexValue = hexInput.value.trim();
            if (isValidHex(hexValue)) {
                colorInput.value = hexValue;
                syncSwatchBackground(colorInput, swatch);
                updatePreview();
            }
        }

        function syncColorToHex(colorInput, hexInput, swatch) {
            hexInput.value = colorInput.value;
            syncSwatchBackground(colorInput, swatch);
            updatePreview();
        }

        if (advancedToggle) {
            advancedToggle.addEventListener('change', function () {
                const hexInputs = modal.querySelectorAll('.larson_hex_advanced');
                hexInputs.forEach(input => {
                    input.style.display = this.checked ? 'block' : 'none';
                });
            });
        }

        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', function () {
                c1.value = randomHex();
                c2.value = randomHex();
                c3.value = randomHex();
                c4.value = randomHex();

                syncColorToHex(c1, hex1, swatch1);
                syncColorToHex(c2, hex2, swatch2);
                syncColorToHex(c3, hex3, swatch3);
                syncColorToHex(c4, hex4, swatch4);
            });
        }

        if (swatch1) swatch1.addEventListener('click', () => c1.click());
        if (swatch2) swatch2.addEventListener('click', () => c2.click());
        if (swatch3) swatch3.addEventListener('click', () => c3.click());
        if (swatch4) swatch4.addEventListener('click', () => c4.click());

        if (c1) c1.addEventListener('input', () => syncColorToHex(c1, hex1, swatch1));
        if (c2) c2.addEventListener('input', () => syncColorToHex(c2, hex2, swatch2));
        if (c3) c3.addEventListener('input', () => syncColorToHex(c3, hex3, swatch3));
        if (c4) c4.addEventListener('input', () => syncColorToHex(c4, hex4, swatch4));

        if (hex1) hex1.addEventListener('input', () => syncHexToColor(hex1, c1, swatch1));
        if (hex2) hex2.addEventListener('input', () => syncHexToColor(hex2, c2, swatch2));
        if (hex3) hex3.addEventListener('input', () => syncHexToColor(hex3, c3, swatch3));
        if (hex4) hex4.addEventListener('input', () => syncHexToColor(hex4, c4, swatch4));

        if (cancel) {
            cancel.addEventListener('click', function () {
                overlay.classList.remove('active');
                editingCustomThemeId = null;
            });
        }

        if (save) {
            save.addEventListener('click', function () {
                const themeName = nameInput.value.trim() || 'Unnamed Theme';
                const colors = [c1.value, c2.value, c3.value, c4.value];

                const s = getSettings();
                if (!Array.isArray(s.customThemes)) s.customThemes = [];

                if (editingCustomThemeId) {
                    const theme = s.customThemes.find(t => t.id === editingCustomThemeId);
                    if (theme) {
                        theme.name = themeName;
                        theme.colors = colors;
                    }
                } else {
                    const newTheme = {
                        id: 'custom-' + Date.now(),
                        name: themeName,
                        colors: colors
                    };
                    s.customThemes.push(newTheme);
                    s.theme = newTheme.id;
                }

                saveSettings();
                applyBarStyles();

                if (typeof window.larson_rebuildDropdownThemes === 'function') {
                    window.larson_rebuildDropdownThemes();
                }

                if (typeof window.larson_renderSettingsCustomThemes === 'function') {
                    window.larson_renderSettingsCustomThemes();
                }

                overlay.classList.remove('active');
                editingCustomThemeId = null;
            });
        }

        updatePreview();

        window.openThemeModal = function (themeId) {
            editingCustomThemeId = themeId;
            const s = getSettings();

            if (themeId) {
                const theme = (s.customThemes || []).find(t => t.id === themeId);
                if (theme) {
                    titleEl.textContent = 'Edit Custom Theme';
                    nameInput.value = theme.name || '';
                    const colors = theme.colors || ['#240046', '#9D00FF', '#E0B0FF', '#FF69B4'];
                    c1.value = colors[0] || '#240046';
                    c2.value = colors[1] || '#9D00FF';
                    c3.value = colors[2] || '#E0B0FF';
                    c4.value = colors[3] || '#FF69B4';
                    hex1.value = c1.value;
                    hex2.value = c2.value;
                    hex3.value = c3.value;
                    hex4.value = c4.value;
                    syncSwatchBackground(c1, swatch1);
                    syncSwatchBackground(c2, swatch2);
                    syncSwatchBackground(c3, swatch3);
                    syncSwatchBackground(c4, swatch4);
                    updatePreview();
                }
            } else {
                titleEl.textContent = 'Create Custom Theme';
                nameInput.value = '';
                c1.value = '#240046';
                c2.value = '#9D00FF';
                c3.value = '#E0B0FF';
                c4.value = '#FF69B4';
                hex1.value = c1.value;
                hex2.value = c2.value;
                hex3.value = c3.value;
                hex4.value = c4.value;
                syncSwatchBackground(c1, swatch1);
                syncSwatchBackground(c2, swatch2);
                syncSwatchBackground(c3, swatch3);
                syncSwatchBackground(c4, swatch4);
                updatePreview();
            }

            overlay.classList.add('active');

            // Apply EXACT same mobile positioning that fixed settings modal
            requestAnimationFrame(function () {
                const isMobile = window.innerWidth <= 768;
                if (isMobile) {
                    // Mobile: Force full viewport height/width to ensure overlay expands
                    overlay.style.height = '100dvh';
                    overlay.style.width = '100%';
                    overlay.style.inset = '0';
                    overlay.style.display = 'flex';
                    overlay.style.alignItems = 'center';
                    overlay.style.justifyContent = 'center';

                    // CRITICAL: Remove fixed positioning on modal - let flexbox center it
                    modal.style.position = 'relative';
                    modal.style.top = 'auto';
                    modal.style.left = 'auto';
                    modal.style.bottom = 'auto';
                    modal.style.right = 'auto';
                    modal.style.transform = 'none';
                    modal.style.margin = 'auto';

                    // Allow modal to scroll
                    modal.style.maxHeight = '85vh';
                    modal.style.overflowY = 'auto';

                    modal.classList.add('larson_theme_modal_mobile');
                    log('Mobile theme modal positioning applied');
                } else {
                    modal.classList.remove('larson_theme_modal_mobile');
                }
            });
        };
    }




    function createBar() {
        var existingWrapper = document.getElementById('larson_bar_container');
        if (existingWrapper) existingWrapper.remove();
        if (barEl && barEl.parentNode) barEl.remove(); // Fallback if orphaned

        const wrapper = document.createElement('div');
        wrapper.id = 'larson_bar_container';
        wrapper.className = 'larson_bar_container';

        barEl = document.createElement('div');
        barEl.id = 'larson_bar';
        barEl.className = 'larson_bar';
        barEl.setAttribute('title', 'Click to open Larson options');

        // Create invisible touch target larger than the bar
        const touchTarget = document.createElement('div');
        touchTarget.className = 'larson_touch_overlay';

        wrapper.appendChild(barEl);
        wrapper.appendChild(touchTarget);

        var target = findInsertTarget();
        if (target) {
            target.parent.insertBefore(wrapper, target.before);

            // Ensure Larson bar stays flush against send_form (below Pathweaver)
            if (target.before && target.before.id === 'send_form' && !window.larsonOrderObserver) {
                window.larsonOrderObserver = new MutationObserver(function () {
                    const currentWrapper = document.getElementById('larson_bar_container');
                    const sf = document.getElementById('send_form');
                    if (currentWrapper && sf && currentWrapper.nextElementSibling !== sf) {
                        if (sf.parentNode === currentWrapper.parentNode) {
                            sf.parentNode.insertBefore(currentWrapper, sf);
                        }
                    }
                });
                window.larsonOrderObserver.observe(target.parent, { childList: true });
            }
        } else {
            document.body.insertBefore(wrapper, document.body.firstChild);
        }

        // Handle both mouse and touch events
        let touchStartY = 0;
        let touchMoved = false;
        let touchStartTime = 0;

        const handleOpen = function (e) {
            e.stopPropagation();
            e.preventDefault();
            toggleDropdown();
        };

        // Mouse events (desktop)
        wrapper.addEventListener('click', handleOpen);

        // Touch events (mobile) - prevent scroll during tap
        wrapper.addEventListener('touchstart', function (e) {
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
            touchMoved = false;
        }, { passive: true });

        wrapper.addEventListener('touchmove', function (e) {
            const touchY = e.touches[0].clientY;
            const deltaY = Math.abs(touchY - touchStartY);
            if (deltaY > 10) {
                touchMoved = true;
            }
        }, { passive: true });

        wrapper.addEventListener('touchend', function (e) {
            const touchDuration = Date.now() - touchStartTime;

            if (!touchMoved && touchDuration < 500) {
                e.stopPropagation();
                e.preventDefault();
                toggleDropdown();
            }
        });

        applyBarStyles();
    }

    function hexToRgba(hex, a) {
        if (!hex || !hex.startsWith('#')) return 'rgba(124,58,237,0.5)';
        let r, g, b;
        if (hex.length === 4) { // #RGB
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
        if (isNaN(r) || isNaN(g) || isNaN(b)) return 'rgba(124,58,237,0.5)';
        return `rgba(${r},${g},${b},${a != null ? a : 0.5})`;
    }


    function updatePreviewBarClasses(previewBar, style, speed) {
        if (!previewBar) return;
        ANIMATION_STYLES.forEach(st => previewBar.classList.remove('larson_style_' + st));
        previewBar.classList.add('larson_style_' + (style || 'gradient'));
        // Preview bars use generic speed classes for simplicity, or we can add specific ones
        previewBar.classList.remove('larson_speed_slow', 'larson_speed_normal', 'larson_speed_fast');
        previewBar.classList.add('larson_speed_' + (speed || 'normal'));
    }

    function animationStyleOptions() {
        return [
            { value: 'gradient', label: 'Gradient' },
            { value: 'breathe', label: 'Breathe' },
            { value: 'pulse', label: 'Pulse' },
            { value: 'cylon', label: 'Cylon' },
            { value: 'segment', label: 'Segment' },
            { value: 'glitch', label: 'Glitch' },
            { value: 'liquid', label: 'Liquid' },
            { value: 'convergence', label: 'Convergence' },
        ];
    }

    function createDropdown() {
        dropdownReady = false;
        if (overlayEl && overlayEl.parentNode) overlayEl.remove();
        overlayEl = document.createElement('div');
        overlayEl.className = 'larson_options_overlay';
        overlayEl.id = 'larson_options_overlay';
        overlayEl.addEventListener('click', function (e) {
            if (e.target === overlayEl) closeOptionsModal();
        });
        dropdownEl = document.createElement('div');
        dropdownEl.className = 'larson_dropdown larson_options_panel';
        dropdownEl.id = 'larson_dropdown';
        dropdownEl.addEventListener('click', function (e) { e.stopPropagation(); });
        dropdownEl.addEventListener('mousedown', function (e) { e.stopPropagation(); });

        const leftPane = document.createElement('div');
        leftPane.className = 'larson_dropdown_pane larson_dropdown_pane_left';
        const styleOpts = animationStyleOptions().map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        leftPane.innerHTML = `
            <!-- Compact Larson Header with Easter Egg -->
            <div class="larson_modal_header_easteregg">
                <h3 class="larson_modal_title">
                    Larson
                    <span class="larson_modal_tooltip">Named after Glen A. Larson, creator of the iconic scanning light effect used in Knight Rider and Battlestar Galactica.</span>
                </h3>
                <div class="larson_modal_close_btn" id="larson_dd_close_btn" title="Close"><i class="fa-solid fa-xmark"></i></div>
            </div>

            <!-- 3-Column Grid Layout -->
            <div class="larson_modal_grid_container">
                <!-- Header Row -->
                <div class="larson_modal_grid_header larson_modal_grid_col_label"></div>
                <div class="larson_modal_grid_header larson_modal_grid_col_animation">Animation</div>
                <div class="larson_modal_grid_header larson_modal_grid_col_speed">Speed</div>

                <!-- Row 1: Generating -->
                <div class="larson_grid_group_wrapper">
                    <div class="larson_modal_grid_label">
                        <i class="fa-solid fa-circle-notch"></i> Generating
                    </div>
                    <div class="larson_modal_grid_control">
                        <select class="larson_dropdown_select larson_dd_style">${styleOpts}</select>
                    </div>
                    <div class="larson_modal_grid_control">
                        <select class="larson_dropdown_select larson_dd_speed">
                            <option value="slow">Slow</option>
                            <option value="normal">Normal</option>
                            <option value="fast">Fast</option>
                        </select>
                    </div>
                </div>

                <!-- Row 2: Idle -->
                <div class="larson_grid_group_wrapper">
                    <div class="larson_modal_grid_label">
                        <label class="larson_modal_grid_checkbox_wrapper">
                            <span><i class="fa-solid fa-pause"></i> Idle</span>
                            <label class="larson_toggle_switch">
                                <input type="checkbox" id="larson_dd_idle_enabled" class="larson_dd_checkbox">
                                <span class="larson_toggle_slider"></span>
                            </label>
                        </label>
                    </div>
                    <div class="larson_modal_grid_control">
                        <select id="larson_dd_idle_style" class="larson_dropdown_select" disabled>${styleOpts}</select>
                    </div>
                    <div class="larson_modal_grid_control">
                        <select id="larson_dd_idle_speed" class="larson_dropdown_select" disabled>
                            <option value="slow">Slow</option>
                            <option value="normal">Normal</option>
                            <option value="fast">Fast</option>
                        </select>
                    </div>
                </div>

                <!-- Row 3: Thinking -->
                <div class="larson_grid_group_wrapper">
                    <div class="larson_modal_grid_label">
                        <label class="larson_modal_grid_checkbox_wrapper">
                            <span><i class="fa-solid fa-brain"></i> Thinking</span>
                            <label class="larson_toggle_switch">
                                <input type="checkbox" id="larson_dd_thinking_enabled" class="larson_dd_checkbox">
                                <span class="larson_toggle_slider"></span>
                            </label>
                        </label>
                    </div>
                    <div class="larson_modal_grid_control">
                        <select id="larson_dd_thinking_style" class="larson_dropdown_select" disabled>${styleOpts}</select>
                    </div>
                    <div class="larson_modal_grid_control">
                        <select id="larson_dd_thinking_speed" class="larson_dropdown_select" disabled>
                            <option value="slow">Slow</option>
                            <option value="normal">Normal</option>
                            <option value="fast">Fast</option>
                        </select>
                    </div>
                    
                    <!-- Warning for Thinking - now part of Thinking section -->
                    <div id="larson_dd_thinking_warning" class="larson_modal_warning larson_thinking_note" style="display: none;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Note: Only functions with Streaming presets.
                    </div>
                </div>
            </div>

            <!-- Global Settings Section -->
            <div class="larson_modal_global_settings">
                <div class="larson_dropdown_row">
                    <label class="larson_dropdown_label"><i class="fa-solid fa-up-down"></i> Bar Height</label>
                    <select class="larson_dropdown_select larson_dd_height">
                        <option value="compact">Compact</option>
                        <option value="default">Default</option>
                        <option value="tall">Tall</option>
                    </select>
                </div>
                
                <div class="larson_dropdown_row">
                    <label class="larson_dropdown_label"><i class="fa-solid fa-eye-slash"></i> Hide When Idle</label>
                    <label class="larson_toggle_switch">
                        <input type="checkbox" id="larson_dd_hide_when_idle" class="larson_dd_checkbox">
                        <span class="larson_toggle_slider"></span>
                    </label>
                </div>
            </div>
        `;

        const rightPane = document.createElement('div');
        rightPane.className = 'larson_dropdown_pane';
        rightPane.innerHTML = '';
        const themeGrid = document.createElement('div');
        themeGrid.className = 'larson_theme_grid';

        const allThemes = getAllThemes();
        const currentStyle = () => (dropdownEl && dropdownEl.querySelector('.larson_dd_style')) ? dropdownEl.querySelector('.larson_dd_style').value : (settings.animation_style || 'gradient-scan');
        const currentSpeed = () => (dropdownEl && dropdownEl.querySelector('.larson_dd_speed')) ? dropdownEl.querySelector('.larson_dd_speed').value : (settings.animation_speed || 'normal');

        allThemes.forEach(theme => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'larson_theme_swatch_row';
            row.dataset.theme = theme.id;

            if (theme.id === 'sillytavern') {
                const colors = theme.colors || [];
                const c1 = colors[0] || '#7c3aed';
                const c2 = colors[1] || '#a855f7';
                const c3 = colors[2] || '#c084fc';
                const c4 = colors[3] || '#d8b4fe';

                const previewBar = document.createElement('div');
                previewBar.className = 'larson_theme_preview_bar larson_preview_animating';
                previewBar.style.setProperty('--larson-color-a', c1);
                previewBar.style.setProperty('--larson-color-b', c2);
                previewBar.style.setProperty('--larson-color-c', c3);
                if (colors.length >= 4) {
                    previewBar.style.setProperty('--larson-color-d', c4);
                }
                previewBar.style.setProperty('--larson-glow', hexToRgba(c1, 0.5));
                updatePreviewBarClasses(previewBar, currentStyle(), currentSpeed());

                row.innerHTML = `<span class="larson_theme_swatch_name">${theme.name}</span>`;

                const infoDiv = document.createElement('div');
                infoDiv.className = 'larson_theme_st_info';
                infoDiv.textContent = 'Uses UI Theme Colors';

                row.appendChild(infoDiv);
            } else {
                const colors = theme.colors || [];
                const c1 = colors[0] || '#7c3aed';
                const c2 = colors[1] || '#a855f7';
                const c3 = colors[2] || '#c084fc';
                const c4 = colors[3] || '#d8b4fe';

                const segHtml = colors.length >= 4
                    ? `<span style="background:${c1}"></span><span style="background:${c2}"></span><span style="background:${c3}"></span><span style="background:${c4}"></span>`
                    : colors.length >= 3
                        ? `<span style="background:${c1}"></span><span style="background:${c2}"></span><span style="background:${c3}"></span>`
                        : `<span style="background:${c1}"></span>`;

                const previewBar = document.createElement('div');
                previewBar.className = 'larson_theme_preview_bar larson_preview_animating';
                previewBar.style.setProperty('--larson-color-a', c1);
                previewBar.style.setProperty('--larson-color-b', c2);
                previewBar.style.setProperty('--larson-color-c', c3);
                if (colors.length >= 4) {
                    previewBar.style.setProperty('--larson-color-d', c4);
                }
                previewBar.style.setProperty('--larson-glow', hexToRgba(c1, 0.5));
                updatePreviewBarClasses(previewBar, currentStyle(), currentSpeed());

                row.innerHTML = `<span class="larson_theme_swatch_name">${theme.name}</span>`;
                const triadicBar = document.createElement('div');
                triadicBar.className = 'larson_theme_triadic_bar larson_theme_triadic_bar_segmented';
                triadicBar.innerHTML = segHtml;
                row.appendChild(triadicBar);
                row.appendChild(previewBar);
                previewBar.style.display = 'none';

                row.addEventListener('mouseenter', function () {
                    triadicBar.style.display = 'none';
                    previewBar.style.display = 'block';
                    previewBar.classList.add('larson_preview_animating');
                    updatePreviewBarClasses(previewBar, currentStyle(), currentSpeed());
                });
                row.addEventListener('mouseleave', function () {
                    previewBar.style.display = 'none';
                    triadicBar.style.display = 'flex';
                });
            }

            row.addEventListener('click', function (e) {
                e.stopPropagation();
                const themeId = this.dataset.theme;
                settings.theme = themeId;
                getSettings().theme = themeId;
                saveSettings();
                applyBarStyles();
                themeGrid.querySelectorAll('.larson_theme_swatch_row').forEach(b => {
                    b.classList.toggle('larson_theme_active', b.dataset.theme === themeId);
                });
            });
            themeGrid.appendChild(row);
        });

        rightPane.appendChild(themeGrid);

        // Custom themes section in dropdown
        const customSection = document.createElement('div');
        customSection.className = 'larson_custom_themes_section';
        customSection.innerHTML = '<div class="larson_custom_themes_title">Custom themes</div><div class="larson_custom_themes_list" id="larson_dd_custom_list"></div><button type="button" class="larson_add_theme_btn" id="larson_dd_add_theme"><i class="fa-solid fa-plus"></i> Add custom theme</button>';
        rightPane.appendChild(customSection);

        dropdownEl.appendChild(leftPane);
        dropdownEl.appendChild(rightPane);
        overlayEl.appendChild(dropdownEl);

        leftPane.querySelector('.larson_dd_style').value = settings.animation_style || 'gradient';
        leftPane.querySelector('.larson_dd_speed').value = settings.animation_speed || 'normal';
        leftPane.querySelector('.larson_dd_height').value = settings.bar_height || 'default';
        var ddIdleEn = leftPane.querySelector('#larson_dd_idle_enabled');
        var ddIdleStyle = leftPane.querySelector('#larson_dd_idle_style');
        var ddIdleSpeed = leftPane.querySelector('#larson_dd_idle_speed');
        var ddThinkEn = leftPane.querySelector('#larson_dd_thinking_enabled');
        var ddThinkStyle = leftPane.querySelector('#larson_dd_thinking_style');
        var ddThinkSpeed = leftPane.querySelector('#larson_dd_thinking_speed');
        var ddThinkWarning = leftPane.querySelector('#larson_dd_thinking_warning');
        var ddHideIdle = leftPane.querySelector('#larson_dd_hide_when_idle');

        if (ddIdleEn) { ddIdleEn.checked = !!settings.idle_animation_enabled; }
        if (ddIdleStyle) {
            ddIdleStyle.value = settings.idle_animation_style || 'pulse';
            ddIdleStyle.disabled = !settings.idle_animation_enabled;
        }
        if (ddIdleSpeed) {
            ddIdleSpeed.value = settings.idle_animation_speed || 'normal';
            ddIdleSpeed.disabled = !settings.idle_animation_enabled;
        }

        if (ddThinkEn) { ddThinkEn.checked = !!settings.thinking_animation_enabled; }
        if (ddThinkStyle) {
            ddThinkStyle.value = settings.thinking_animation_style || 'gradient';
            ddThinkStyle.disabled = !settings.thinking_animation_enabled;
        }
        if (ddThinkSpeed) {
            ddThinkSpeed.value = settings.thinking_animation_speed || 'normal';
            ddThinkSpeed.disabled = !settings.thinking_animation_enabled;
        }
        if (ddThinkWarning) {
            ddThinkWarning.style.display = settings.thinking_animation_enabled ? 'flex' : 'none';
        }

        if (ddHideIdle) { ddHideIdle.checked = !!settings.hide_when_idle; }


        function syncStyleSpeedToPreviews() {
            const style = leftPane.querySelector('.larson_dd_style').value;
            const speed = leftPane.querySelector('.larson_dd_speed').value;
            themeGrid.querySelectorAll('.larson_theme_preview_bar').forEach(pb => {
                updatePreviewBarClasses(pb, style, speed);
            });
        }

        leftPane.querySelector('.larson_dd_style').addEventListener('change', function () {
            settings.animation_style = this.value;
            getSettings().animation_style = this.value;
            saveSettings();
            applyBarStyles();
            syncStyleSpeedToPreviews();
        });
        leftPane.querySelector('.larson_dd_speed').addEventListener('change', function () {
            settings.animation_speed = this.value;
            getSettings().animation_speed = this.value;
            saveSettings();
            applyBarStyles();
            syncStyleSpeedToPreviews();
        });
        leftPane.querySelector('.larson_dd_height').addEventListener('change', function () {
            settings.bar_height = this.value;
            getSettings().bar_height = this.value;
            saveSettings();
            applyBarStyles();
        });
        if (ddIdleEn) ddIdleEn.addEventListener('change', function () {
            settings.idle_animation_enabled = this.checked;
            getSettings().idle_animation_enabled = this.checked;
            saveSettings();
            // Enable/disable the idle dropdowns
            if (ddIdleStyle) ddIdleStyle.disabled = !this.checked;
            if (ddIdleSpeed) ddIdleSpeed.disabled = !this.checked;
            applyBarStyles();
        });
        if (ddIdleStyle) ddIdleStyle.addEventListener('change', function () {
            settings.idle_animation_style = this.value;
            getSettings().idle_animation_style = this.value;
            saveSettings();
            applyBarStyles();
        });
        if (ddIdleSpeed) ddIdleSpeed.addEventListener('change', function () {
            settings.idle_animation_speed = this.value;
            getSettings().idle_animation_speed = this.value;
            saveSettings();
            applyBarStyles();
        });
        if (ddThinkEn) ddThinkEn.addEventListener('change', function () {
            settings.thinking_animation_enabled = this.checked;
            getSettings().thinking_animation_enabled = this.checked;
            saveSettings();
            // Enable/disable the thinking dropdowns
            if (ddThinkStyle) ddThinkStyle.disabled = !this.checked;
            if (ddThinkSpeed) ddThinkSpeed.disabled = !this.checked;
            // Show/hide the thinking warning
            if (ddThinkWarning) ddThinkWarning.style.display = this.checked ? 'flex' : 'none';
            applyBarStyles();
        });
        if (ddThinkStyle) ddThinkStyle.addEventListener('change', function () {
            settings.thinking_animation_style = this.value;
            getSettings().thinking_animation_style = this.value;
            saveSettings();
            applyBarStyles();
        });
        if (ddThinkSpeed) ddThinkSpeed.addEventListener('change', function () {
            settings.thinking_animation_speed = this.value;
            getSettings().thinking_animation_speed = this.value;
            saveSettings();
            applyBarStyles();
        });
        if (ddHideIdle) ddHideIdle.addEventListener('change', function () {
            settings.hide_when_idle = this.checked;
            getSettings().hide_when_idle = this.checked;
            saveSettings();
            applyBarStyles();
        });

        themeGrid.querySelectorAll('.larson_theme_swatch_row').forEach(b => {
            b.classList.toggle('larson_theme_active', b.dataset.theme === (settings.theme || 'sillytavern'));
        });

        function renderDropdownCustomThemes() {
            const list = dropdownEl.querySelector('#larson_dd_custom_list');
            if (!list) return;
            list.innerHTML = '';
            (getSettings().customThemes || []).forEach(ct => {
                const colors = ct.colors || [];
                const c1 = colors[0] || '#7c3aed', c2 = colors[1] || '#a855f7', c3 = colors[2] || '#c084fc';
                const item = document.createElement('div');
                item.className = 'larson_custom_theme_item';
                item.innerHTML = `
                    <span class="larson_custom_theme_item_name" title="${(ct.name || '').replace(/"/g, '&quot;')}">${ct.name || 'Unnamed'}</span>
                    <div class="larson_custom_theme_item_bar">
                        <span style="background:${c1}"></span><span style="background:${c2}"></span><span style="background:${c3}"></span>
                    </div>
                    <div class="larson_custom_theme_item_actions">
                        <button type="button" class="larson_custom_theme_btn_sm larson_edit_theme" data-id="${ct.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="larson_custom_theme_btn_sm larson_btn_delete larson_delete_theme" data-id="${ct.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                item.querySelector('.larson_edit_theme').addEventListener('click', function (ev) { ev.stopPropagation(); openThemeModal(ct.id); });
                item.querySelector('.larson_delete_theme').addEventListener('click', function (ev) { ev.stopPropagation(); confirmDeleteCustomTheme(ct.id, ct.name); });
                list.appendChild(item);
            });
        }

        function addCustomThemeToGrid(theme) {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'larson_theme_swatch_row';
            row.dataset.theme = theme.id;
            const colors = theme.colors || [];
            const c1 = colors[0] || '#7c3aed', c2 = colors[1] || '#a855f7', c3 = colors[2] || '#c084fc';
            const segHtml = `<span style="background:${c1}"></span><span style="background:${c2}"></span><span style="background:${c3}"></span>`;
            const previewBar = document.createElement('div');
            previewBar.className = 'larson_theme_preview_bar larson_preview_animating';
            previewBar.style.setProperty('--larson-color-a', c1);
            previewBar.style.setProperty('--larson-color-b', c2);
            previewBar.style.setProperty('--larson-color-c', c3);
            previewBar.style.setProperty('--larson-glow', hexToRgba(c1, 0.5));
            updatePreviewBarClasses(previewBar, currentStyle(), currentSpeed());
            row.innerHTML = `<span class="larson_theme_swatch_name">${theme.name}</span>`;
            const triadicBar = document.createElement('div');
            triadicBar.className = 'larson_theme_triadic_bar larson_theme_triadic_bar_segmented';
            triadicBar.innerHTML = segHtml;
            row.appendChild(triadicBar);
            row.appendChild(previewBar);
            previewBar.style.display = 'none';
            row.addEventListener('mouseenter', function () {
                triadicBar.style.display = 'none';
                previewBar.style.display = 'block';
                updatePreviewBarClasses(previewBar, currentStyle(), currentSpeed());
            });
            row.addEventListener('mouseleave', function () {
                previewBar.style.display = 'none';
                triadicBar.style.display = 'flex';
            });
            row.addEventListener('click', function (e) {
                e.stopPropagation();
                settings.theme = theme.id;
                getSettings().theme = theme.id;
                saveSettings();
                applyBarStyles();
                themeGrid.querySelectorAll('.larson_theme_swatch_row').forEach(b => {
                    b.classList.toggle('larson_theme_active', b.dataset.theme === theme.id);
                });
            });
            themeGrid.appendChild(row);
        }

        window.larson_rebuildDropdownThemes = function () {
            const existingIds = new Set(BUILT_IN_THEMES.map(t => t.id));
            const custom = getSettings().customThemes || [];
            themeGrid.querySelectorAll('.larson_theme_swatch_row').forEach(el => {
                if (!existingIds.has(el.dataset.theme)) el.remove();
            });
            custom.forEach(ct => {
                if (!themeGrid.querySelector('.larson_theme_swatch_row[data-theme="' + ct.id + '"]')) {
                    const theme = { id: ct.id, name: ct.name, colors: ct.colors || [] };
                    addCustomThemeToGrid(theme);
                }
            });
            themeGrid.querySelectorAll('.larson_theme_swatch_row').forEach(b => {
                b.classList.toggle('larson_theme_active', b.dataset.theme === (settings.theme || 'user'));
            });
            renderDropdownCustomThemes();
        };



        var addThemeBtn = dropdownEl.querySelector('#larson_dd_add_theme');
        if (addThemeBtn) {
            log('Add theme button found, attaching events');

            const openModal = function (e) {
                log('Add theme button clicked/tapped');
                if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                }
                openThemeModal(null);
            };

            // Mouse/pointer events
            addThemeBtn.addEventListener('click', openModal, false);

            // Touch events for mobile
            let touchStarted = false;
            addThemeBtn.addEventListener('touchstart', function (e) {
                touchStarted = true;
                log('Touch start on add theme button');
            }, { passive: true });

            addThemeBtn.addEventListener('touchend', function (e) {
                if (touchStarted) {
                    log('Touch end on add theme button - opening modal');
                    e.stopPropagation();
                    e.preventDefault();
                    touchStarted = false;
                    openThemeModal(null);
                }
            }, { passive: false });
        } else {
            log('Add theme button NOT found in dropdown');
        }

        // Close button listener
        var closeBtn = dropdownEl.querySelector('#larson_dd_close_btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                closeOptionsModal();
            });
        }

        renderDropdownCustomThemes();
        dropdownReady = true;
    }

    function openThemeModal(customThemeId) {
        createThemeModal();
        if (typeof window.openThemeModal === 'function') {
            window.openThemeModal(customThemeId);
        }
    }

    function syncHexFromColor(inputColor, inputHex) {
        const v = inputColor.value;
        if (inputHex) inputHex.value = v;
    }
    function syncColorFromHex(inputHex, inputColor) {
        const v = (inputHex.value || '').trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
            inputColor.value = v;
            return true;
        }
        return false;
    }

    function saveThemeFromModal() {
        const nameInput = document.getElementById('larson_theme_modal_name');
        const harmonySelect = document.getElementById('larson_theme_modal_harmony');
        const baseColor = document.getElementById('larson_theme_modal_base');
        const c1 = document.getElementById('larson_theme_modal_c1');
        const c2 = document.getElementById('larson_theme_modal_c2');
        const c3 = document.getElementById('larson_theme_modal_c3');
        const c4 = document.getElementById('larson_theme_modal_c4');
        const name = (nameInput && nameInput.value || '').trim() || 'Custom theme';
        const harmony = (harmonySelect && harmonySelect.value) || 'manual';
        let colors;
        if (harmony !== 'manual' && baseColor && baseColor.value) {
            const computed = computeHarmonyColors(baseColor.value, harmony);
            colors = computed || [
                (c1 && c1.value) || '#7c3aed',
                (c2 && c2.value) || '#a855f7',
                (c3 && c3.value) || '#c084fc',
                (c4 && c4.value) || '#d8b4fe'
            ];
        } else {
            colors = [
                (c1 && c1.value) || '#7c3aed',
                (c2 && c2.value) || '#a855f7',
                (c3 && c3.value) || '#c084fc',
                (c4 && c4.value) || '#d8b4fe',
            ];
        }
        const s = getSettings();
        if (!s.customThemes) s.customThemes = [];
        if (editingCustomThemeId) {
            const idx = s.customThemes.findIndex(t => t.id === editingCustomThemeId);
            if (idx >= 0) {
                s.customThemes[idx].name = name;
                s.customThemes[idx].colors = colors;
            }
        } else {
            const id = 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            s.customThemes.push({ id, name, colors });
        }
        saveSettings();
        applyBarStyles();
        if (typeof window.larson_rebuildDropdownThemes === 'function') window.larson_rebuildDropdownThemes();
        if (typeof window.larson_renderSettingsCustomThemes === 'function') window.larson_renderSettingsCustomThemes();
        if (typeof window.larson_refreshThemeSelect === 'function') window.larson_refreshThemeSelect();
        document.getElementById('larson_theme_modal_overlay').classList.remove('active');
        editingCustomThemeId = null;
    }

    function deleteCustomTheme(id) {
        const s = getSettings();
        if (!s.customThemes) return;
        s.customThemes = s.customThemes.filter(t => t.id !== id);
        if (s.theme === id) s.theme = 'user';
        saveSettings();
        applyBarStyles();
        if (typeof window.larson_rebuildDropdownThemes === 'function') window.larson_rebuildDropdownThemes();
        if (typeof window.larson_renderSettingsCustomThemes === 'function') window.larson_renderSettingsCustomThemes();
        if (typeof window.larson_refreshThemeSelect === 'function') window.larson_refreshThemeSelect();
    }

    async function confirmDeleteCustomTheme(id, name) {
        const ctx = getContext();
        let confirmed = false;
        var deleteMsg = 'Are you sure you want to delete "' + (name || 'Unnamed') + '"? This cannot be undone.';
        if (ctx && ctx.Popup && typeof ctx.Popup.show === 'object' && typeof ctx.Popup.show.confirm === 'function') {
            try {
                confirmed = await ctx.Popup.show.confirm('Delete custom theme', deleteMsg);
            } catch (e) {
                confirmed = window.confirm('Are you sure you want to delete this theme?');
            }
        } else if (typeof toastr !== 'undefined' && toastr.warning) {
            confirmed = window.confirm(deleteMsg);
        } else {
            confirmed = window.confirm('Are you sure you want to delete this theme?');
        }
        if (confirmed) deleteCustomTheme(id);
    }

    function toggleDropdown() {
        loadSettings();
        if (!settings.enabled) return;
        if (overlayEl && overlayEl.parentNode) {
            closeOptionsModal();
            return;
        }
        if (overlayEl && !dropdownReady) return;
        if (!overlayEl || !dropdownEl) createDropdown();
        if (!dropdownReady) return;
        const s = getSettings();
        if (dropdownEl.querySelector('.larson_dd_style')) dropdownEl.querySelector('.larson_dd_style').value = s.animation_style || 'gradient-scan';
        if (dropdownEl.querySelector('.larson_dd_speed')) dropdownEl.querySelector('.larson_dd_speed').value = s.animation_speed || 'normal';
        if (dropdownEl.querySelector('.larson_dd_height')) dropdownEl.querySelector('.larson_dd_height').value = s.bar_height || 'default';
        var saIdle = dropdownEl.querySelector('#larson_dd_idle_enabled');
        if (saIdle) { saIdle.checked = !!s.idle_animation_enabled; }
        var idleStyleSel = dropdownEl.querySelector('#larson_dd_idle_style');
        if (idleStyleSel) {
            idleStyleSel.value = s.idle_animation_style || 'pulse';
            idleStyleSel.disabled = !s.idle_animation_enabled;
        }
        var idleSpeedSel = dropdownEl.querySelector('#larson_dd_idle_speed');
        if (idleSpeedSel) {
            idleSpeedSel.value = s.idle_animation_speed || 'normal';
            idleSpeedSel.disabled = !s.idle_animation_enabled;
        }
        var saThink = dropdownEl.querySelector('#larson_dd_thinking_enabled');
        if (saThink) { saThink.checked = !!s.thinking_animation_enabled; }
        var thinkStyleSel = dropdownEl.querySelector('#larson_dd_thinking_style');
        if (thinkStyleSel) {
            thinkStyleSel.value = s.thinking_animation_style || 'shimmer';
            thinkStyleSel.disabled = !s.thinking_animation_enabled;
        }
        var thinkSpeedSel = dropdownEl.querySelector('#larson_dd_thinking_speed');
        if (thinkSpeedSel) {
            thinkSpeedSel.value = s.thinking_animation_speed || 'normal';
            thinkSpeedSel.disabled = !s.thinking_animation_enabled;
        }
        var thinkWarning = dropdownEl.querySelector('#larson_dd_thinking_warning');
        if (thinkWarning) thinkWarning.style.display = s.thinking_animation_enabled ? 'flex' : 'none';
        var hideIdleCb = dropdownEl.querySelector('#larson_dd_hide_when_idle');
        if (hideIdleCb) { hideIdleCb.checked = !!s.hide_when_idle; }
        dropdownEl.querySelectorAll('.larson_theme_swatch_row').forEach(b => {
            b.classList.toggle('larson_theme_active', b.dataset.theme === (s.theme || 'user'));
        });
        if (typeof window.larson_rebuildDropdownThemes === 'function') window.larson_rebuildDropdownThemes();
        if (barEl) barEl.removeAttribute('title');
        document.body.appendChild(overlayEl);
        overlayEl.classList.add('larson_options_overlay_open');

        // Position modal: on mobile force explicit height to fix iPhone/Safari collapsing
        requestAnimationFrame(function () {
            if (window.innerWidth <= 768) {
                // Mobile: Force full viewport height/width to ensure overlay expands
                overlayEl.style.height = '100dvh';
                overlayEl.style.width = '100%';
                overlayEl.style.inset = '0';
                overlayEl.style.display = 'flex';
                overlayEl.style.alignItems = 'center';
                overlayEl.style.justifyContent = 'center';

                // CRITICAL: Remove fixed positioning on dropdown - let flexbox center it
                dropdownEl.style.position = 'relative';
                dropdownEl.style.top = 'auto';
                dropdownEl.style.left = 'auto';
                dropdownEl.style.bottom = 'auto';
                dropdownEl.style.right = 'auto';
                dropdownEl.style.transform = 'none';
                dropdownEl.style.margin = 'auto';

                // Allow dropdown to scroll
                dropdownEl.style.maxHeight = '85vh';
                dropdownEl.style.overflowY = 'auto';

                log('Mobile positioning applied');
                log('Dropdown position:', dropdownEl.style.position);
                log('Dropdown rect:', dropdownEl.getBoundingClientRect());
            } else {
                // Desktop: Clear forced styles
                overlayEl.style.height = '';
                overlayEl.style.width = '';
                overlayEl.style.inset = '';
                dropdownEl.style.maxHeight = '';
                dropdownEl.style.overflowY = '';

                if (barEl) {
                    var barRect = barEl.getBoundingClientRect();
                    var gap = 8;
                    dropdownEl.style.bottom = (window.innerHeight - barRect.top + gap) + 'px';
                    var w = dropdownEl.offsetWidth || 420;
                    var left = barRect.left + (barRect.width / 2) - (w / 2);
                    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
                    dropdownEl.style.left = left + 'px';
                }
            }
        });
        optionsModalEscapeHandler = function (e) { if (e.key === 'Escape') closeOptionsModal(); };
        document.addEventListener('keydown', optionsModalEscapeHandler);
        setTimeout(function () {
            document.addEventListener('click', closeDropdownOnClick);
            // Also handle touch events for closing
            document.addEventListener('touchend', closeDropdownOnClick);
        }, 0);
    }

    function closeDropdownOnClick(e) {
        var themeModal = document.getElementById('larson_theme_modal_overlay');
        if (themeModal && themeModal.contains(e.target)) return;
        if (e.target === overlayEl) closeOptionsModal();
    }

    function handleMessageSent(data) {
        log('handleMessageSent triggered', data);
        loadSettings();
        if (!barEl || !settings.enabled) return;

        // Gate: Only treat as user message if there was recent interaction (click/keypress)
        // This filters out system messages or auto-greetings on chat load.
        // Allow 2000ms buffer for interactions.
        if (Date.now() - lastUserAction > 2000) {
            log('handleMessageSent ignored: no recent user action');
            return;
        }

        if (Date.now() - lastGenerationEndedAt < 400) return;

        explicitUserGeneration = true;
        log('explicitUserGeneration set to TRUE');

        barEl.classList.remove('larson_idle_static');
        ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_idle_style_' + st));
        barEl.classList.add('larson_processing');
        barEl.classList.add('larson_thinking');
        applyBarStyles();
    }

    function handleGenerationStarted() {
        log('handleGenerationStarted triggered');
        loadSettings();
        if (!barEl || !settings.enabled) return;

        // Fix for idle animation on chat load: 
        if (!explicitUserGeneration) {
            log('handleGenerationStarted ignored: explicitUserGeneration is false');
            return;
        }

        if (Date.now() - lastGenerationEndedAt < 400) return;

        // Reset thinking state for new generation
        isInThinkingBlock = false;
        hasReceivedRealContent = false;
        tokenBuffer = '';

        barEl.classList.remove('larson_idle_static');
        ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_idle_style_' + st));
        if (!barEl.classList.contains('larson_processing')) {
            barEl.classList.add('larson_thinking');
        }
        barEl.classList.add('larson_processing');
        applyBarStyles();
    }

    function handleFirstTokenOrGenerationStarted() {
        log('handleFirstTokenOrGenerationStarted triggered');
        loadSettings();
        if (!barEl || !settings.enabled) return;

        if (!explicitUserGeneration) return;

        if (barEl.classList.contains('larson_processing')) {
            barEl.classList.remove('larson_thinking');
            ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_thinking_style_' + st));
            applyBarStyles();
        } else {
            if (Date.now() - lastGenerationEndedAt < 200) return;
            explicitUserGeneration = true;
            applyBarStyles();
            barEl.classList.add('larson_processing');
        }
    }

    function handleGenerationEnded() {
        log('handleGenerationEnded triggered');
        lastGenerationEndedAt = Date.now();
        explicitUserGeneration = false;
        isGeneratingFromStopButton = false;
        isInThinkingBlock = false;
        hasReceivedRealContent = false;
        tokenBuffer = '';
        if (barEl) {
            barEl.classList.remove('larson_processing', 'larson_thinking');
            ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_thinking_style_' + st));
            applyBarStyles();
        }
    }

    function handleGenerationStopped() {
        log('handleGenerationStopped triggered');
        lastGenerationEndedAt = Date.now();
        explicitUserGeneration = false;
        isGeneratingFromStopButton = false;
        isInThinkingBlock = false;
        hasReceivedRealContent = false;
        tokenBuffer = '';
        if (barEl) {
            barEl.classList.remove('larson_processing', 'larson_thinking');
            ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_thinking_style_' + st));
            applyBarStyles();
        }
    }

    function handleChatChanged() {
        log('handleChatChanged triggered');
        explicitUserGeneration = false;
        isGeneratingFromStopButton = false;
        isInThinkingBlock = false;
        hasReceivedRealContent = false;
        tokenBuffer = '';
        if (barEl) {
            barEl.classList.remove('larson_processing', 'larson_thinking');
            ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_thinking_style_' + st));
            applyBarStyles();
        }
    }

    // Transition the bar from Thinking animation to Generating animation
    function transitionToGenerating() {
        if (!barEl) return;
        if (!barEl.classList.contains('larson_thinking')) return;
        log('Transitioning from Thinking to Generating animation');
        barEl.classList.remove('larson_thinking');
        ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_thinking_style_' + st));
        isInThinkingBlock = false;
        hasReceivedRealContent = true;
        applyBarStyles();
    }

    // Handle stream token received - detects thinking vs generating content
    // Gemini pattern: empty tokens during thinking, then STREAM_REASONING_DONE fires
    // Other LLMs: tokens wrapped in <thinking>, <think>, <reasoning>, <reason>, <thought> tags
    function handleStreamToken(token) {
        if (!barEl || !settings.enabled) return;
        if (!barEl.classList.contains('larson_processing')) return;

        // Already transitioned to generating - nothing to do
        if (hasReceivedRealContent) return;

        const text = (typeof token === 'string') ? token : '';

        // Add current token to buffer (keep last 50 chars to catch split tags)
        tokenBuffer += text;
        if (tokenBuffer.length > 50) {
            tokenBuffer = tokenBuffer.slice(-50);
        }

        const textLower = text.toLowerCase();
        const bufferLower = tokenBuffer.toLowerCase();

        // Check for thinking open tags (entering thinking block)
        // Check both current token and buffer to catch split tags
        for (const tag of THINKING_OPEN_TAGS) {
            if (textLower.includes(tag) || bufferLower.includes(tag)) {
                isInThinkingBlock = true;
                log('handleStreamToken: Entered thinking block via tag:', tag);
                return; // Stay in thinking state
            }
        }

        // Check for thinking close tags (leaving thinking block)
        // Check both current token and buffer to catch split tags
        for (const tag of THINKING_CLOSE_TAGS) {
            if (textLower.includes(tag) || bufferLower.includes(tag)) {
                log('handleStreamToken: Thinking close tag detected:', tag);
                isInThinkingBlock = false;
                tokenBuffer = ''; // Clear buffer after finding close tag
                transitionToGenerating();
                return;
            }
        }

        // If we're inside a thinking tag block, stay in thinking
        if (isInThinkingBlock) return;

        // Gemini pattern: empty tokens during thinking phase
        // Stay in thinking if token is empty
        if (text.trim() === '') return;

        // Non-empty, non-thinking token received = real content is streaming
        // Only transition if we're still in thinking state
        if (barEl.classList.contains('larson_thinking')) {
            log('handleStreamToken: Real content token received, transitioning to Generating');
            transitionToGenerating();
        }
    }

    // Handle STREAM_REASONING_DONE event (Gemini's native thinking-complete signal)
    // This fires exactly once when the AI finishes its reasoning/thinking phase
    function handleStreamReasoningDone() {
        if (!barEl || !settings.enabled) return;
        log('handleStreamReasoningDone: Reasoning phase complete');
        isInThinkingBlock = false;
        transitionToGenerating();
    }

    // Theme change observer
    let themeObserver = null;

    function setupThemeObserver() {
        if (themeObserver) return;
        const target = document.body;
        if (!target) return;

        themeObserver = new MutationObserver((mutations) => {
            const s = getSettings();
            if (s.theme === 'sillytavern') {
                // If we are using the SillyTavern theme, we need to refresh colors when the body class changes
                // as that usually indicates a theme switch in ST.
                applyBarStyles();
            }
        });

        themeObserver.observe(target, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });
        log('Theme observer set up');
    }

    function cleanupThemeObserver() {
        if (themeObserver) {
            themeObserver.disconnect();
            themeObserver = null;
        }
    }

    const onBodyClick = (e) => {
        // Track all generation-triggering button clicks
        if (e.target.closest('#send_but') || e.target.closest('.mes_send') ||
            e.target.closest('#mes_continue') || e.target.closest('.swipe_right') ||
            e.target.closest('.swipe_left') || e.target.closest('.mes_edit_done')) {
            lastUserAction = Date.now();
            log('User action detected (click):', e.target);
        }
    };

    const onBodyKeyDown = (e) => {
        if ((e.key === 'Enter' && !e.shiftKey) && (e.target.id === 'send_textarea' || e.target.classList.contains('text_pole'))) {
            lastUserAction = Date.now();
            log('User action detected (keydown)');
        }
    };

    // MutationObserver to watch for #mes_stop visibility changes as a reliable generation indicator
    let mesStopObserver = null;
    let isGeneratingFromStopButton = false;

    function setupMesStopObserver() {
        if (mesStopObserver) return; // Already set up

        const checkMesStop = () => {
            const mesStop = document.getElementById('mes_stop');
            if (!mesStop) {
                // Retry if not found yet
                setTimeout(checkMesStop, 500);
                return;
            }

            mesStopObserver = new MutationObserver((mutations) => {
                const mesStop = document.getElementById('mes_stop');
                if (!mesStop || !barEl || !settings.enabled) return;

                const computedStyle = window.getComputedStyle(mesStop);
                const isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';

                if (isVisible && !isGeneratingFromStopButton) {
                    // Stop button just became visible - generation started
                    isGeneratingFromStopButton = true;
                    log('mes_stop became visible - generation detected (isGenerating:', isGeneratingFromStopButton, ')');

                    // Only trigger if we haven't already started processing
                    if (!barEl.classList.contains('larson_processing')) {
                        // Set explicitUserGeneration true since user caused this generation somehow
                        explicitUserGeneration = true;
                        barEl.classList.remove('larson_idle_static');
                        ANIMATION_STYLES.forEach(st => barEl.classList.remove('larson_idle_style_' + st));
                        barEl.classList.add('larson_processing');
                        barEl.classList.add('larson_thinking');
                        applyBarStyles();
                    }
                } else if (!isVisible && isGeneratingFromStopButton) {
                    // Stop button just became hidden - generation ended
                    isGeneratingFromStopButton = false;
                    log('mes_stop became hidden - generation ended');

                    // Don't call handleGenerationEnded here as events will handle it
                    // But ensure we reset if somehow the event didn't fire
                    setTimeout(() => {
                        if (!isGeneratingFromStopButton && barEl && barEl.classList.contains('larson_processing')) {
                            log('Fallback: cleaning up processing state');
                            handleGenerationEnded();
                        }
                    }, 500);
                }
            });

            // Observe style and class changes on mes_stop and its parent
            mesStopObserver.observe(mesStop, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });

            // Also observe parent for visibility changes
            if (mesStop.parentElement) {
                mesStopObserver.observe(mesStop.parentElement, {
                    attributes: true,
                    attributeFilter: ['style', 'class'],
                    childList: true
                });
            }

            log('MutationObserver set up for mes_stop');
        };

        checkMesStop();
    }

    function cleanupMesStopObserver() {
        if (mesStopObserver) {
            mesStopObserver.disconnect();
            mesStopObserver = null;
        }
        isGeneratingFromStopButton = false;
    }

    function registerEvents() {
        const ctx = getContext();
        if (!ctx || !ctx.eventSource || !ctx.event_types) {
            error('Cannot register events - context missing or invalid', ctx);
            return;
        }
        extensionReadyAt = Date.now();
        const et = ctx.event_types;

        // Listen for user interactions to validate generations - use named handlers for proper cleanup
        document.body.addEventListener('click', onBodyClick, true);
        document.body.addEventListener('keydown', onBodyKeyDown, true);

        // Set up MutationObserver for mes_stop button to reliably detect generation state
        setupMesStopObserver();

        // Set up Theme observer to sync with SillyTavern theme changes
        setupThemeObserver();

        log('Registering events with types:', et);
        var messageSent = et.MESSAGE_SENT || et.message_sent;
        var generationEnded = et.GENERATION_ENDED || et.generation_ended;
        var generationStopped = et.GENERATION_STOPPED || et.generation_stopped;
        var firstTokenEvent = et.FIRST_TOKEN_RECEIVED || et.GENERATION_STARTED;
        var generationStarted = et.GENERATION_STARTED || et.generation_started;
        var chatChanged = et.CHAT_CHANGED || et.chat_changed;
        var streamTokenEvent = et.STREAM_TOKEN_RECEIVED || et.stream_token_received;
        var streamReasoningDone = et.STREAM_REASONING_DONE || et.stream_reasoning_done;

        log('Event mappings:', { messageSent, generationStarted, generationEnded, generationStopped, firstTokenEvent, streamTokenEvent, streamReasoningDone });

        const es = ctx.eventSource;
        if (messageSent) es.on(messageSent, handleMessageSent);
        if (generationEnded) es.on(generationEnded, handleGenerationEnded);
        if (generationStopped) es.on(generationStopped, handleGenerationStopped);
        if (firstTokenEvent) es.on(firstTokenEvent, handleFirstTokenOrGenerationStarted);
        if (generationStarted && generationStarted !== firstTokenEvent) es.on(generationStarted, handleGenerationStarted);
        if (chatChanged) es.on(chatChanged, handleChatChanged);
        // Stream token event - used to detect thinking content and transition to Generating animation
        if (streamTokenEvent) es.on(streamTokenEvent, handleStreamToken);
        // Stream reasoning done - Gemini's native signal that thinking/reasoning is complete
        if (streamReasoningDone) es.on(streamReasoningDone, handleStreamReasoningDone);
    }

    function unregisterEvents() {
        // Remove DOM listeners
        document.body.removeEventListener('click', onBodyClick, true);
        document.body.removeEventListener('keydown', onBodyKeyDown, true);

        // Clean up MutationObserver
        cleanupMesStopObserver();
        cleanupThemeObserver();

        const ctx = getContext();
        if (!ctx || !ctx.eventSource || !ctx.event_types) return;
        const et = ctx.event_types;
        var messageSent = et.MESSAGE_SENT || et.message_sent;
        var generationEnded = et.GENERATION_ENDED || et.generation_ended;
        var generationStopped = et.GENERATION_STOPPED || et.generation_stopped;
        var chatChanged = et.CHAT_CHANGED || et.chat_changed;

        if (messageSent) {
            ctx.eventSource.removeListener(messageSent, handleMessageSent);
            if (messageSent !== 'MESSAGE_SENT') ctx.eventSource.removeListener('MESSAGE_SENT', handleMessageSent);
        }
        var generationStarted = et.GENERATION_STARTED || et.generation_started;
        if (generationStarted) {
            ctx.eventSource.removeListener(generationStarted, handleGenerationStarted);
            if (generationStarted !== 'GENERATION_STARTED') ctx.eventSource.removeListener('GENERATION_STARTED', handleGenerationStarted);
        }
        if (generationEnded) ctx.eventSource.removeListener(generationEnded, handleGenerationEnded);
        if (generationStopped) ctx.eventSource.removeListener(generationStopped, handleGenerationStopped);
        var firstTokenEvent = et.FIRST_TOKEN_RECEIVED || et.MESSAGE_RECEIVED || et.GENERATION_STARTED || et.CHAT_MESSAGE_RECEIVED;
        if (firstTokenEvent) ctx.eventSource.removeListener(firstTokenEvent, handleFirstTokenOrGenerationStarted);
        if (chatChanged) ctx.eventSource.removeListener(chatChanged, handleChatChanged);
        var streamTokenEvent = et.STREAM_TOKEN_RECEIVED || et.stream_token_received;
        if (streamTokenEvent) ctx.eventSource.removeListener(streamTokenEvent, handleStreamToken);
        var streamReasoningDone = et.STREAM_REASONING_DONE || et.stream_reasoning_done;
        if (streamReasoningDone) ctx.eventSource.removeListener(streamReasoningDone, handleStreamReasoningDone);
    }

    function applySettingsToUI() {
        if (!document.getElementById('larson_enabled')) return;
        const s = getSettings();
        const cb = document.getElementById('larson_enabled');
        if (cb) cb.checked = !!s.enabled;
        const height = document.getElementById('larson_bar_height');
        if (height) height.value = s.bar_height || 'default';
        const style = document.getElementById('larson_animation_style');
        if (style) style.value = s.animation_style || 'gradient-scan';
        const speed = document.getElementById('larson_animation_speed');
        if (speed) speed.value = s.animation_speed || 'normal';
        const idleCb = document.getElementById('larson_idle_enabled');
        if (idleCb) idleCb.checked = !!s.idle_animation_enabled;
        const idleStyle = document.getElementById('larson_idle_style');
        if (idleStyle) {
            idleStyle.value = s.idle_animation_style || 'pulse';
            idleStyle.disabled = !s.idle_animation_enabled;
        }
        const idleSpeed = document.getElementById('larson_idle_speed');
        if (idleSpeed) {
            idleSpeed.value = s.idle_animation_speed || 'normal';
            idleSpeed.disabled = !s.idle_animation_enabled;
        }
        const thinkCb = document.getElementById('larson_thinking_enabled');
        if (thinkCb) thinkCb.checked = !!s.thinking_animation_enabled;
        const thinkStyle = document.getElementById('larson_thinking_style');
        if (thinkStyle) {
            thinkStyle.value = s.thinking_animation_style || 'shimmer';
            thinkStyle.disabled = !s.thinking_animation_enabled;
        }
        const thinkSpeed = document.getElementById('larson_thinking_speed');
        if (thinkSpeed) {
            thinkSpeed.value = s.thinking_animation_speed || 'normal';
            thinkSpeed.disabled = !s.thinking_animation_enabled;
        }
        const thinkWarning = document.getElementById('larson_thinking_warning');
        if (thinkWarning) thinkWarning.style.display = s.thinking_animation_enabled ? 'flex' : 'none';
        const hideIdleCb = document.getElementById('larson_hide_when_idle');
        if (hideIdleCb) hideIdleCb.checked = !!s.hide_when_idle;
        if (typeof window.larson_refreshThemeSelect === 'function') window.larson_refreshThemeSelect();
        const theme = document.getElementById('larson_theme');
        if (theme) theme.value = s.theme || 'user';

        if (typeof window.larson_renderSettingsCustomThemes === 'function') window.larson_renderSettingsCustomThemes();
    }

    window.larson_refreshThemeSelect = function () {
        const sel = document.getElementById('larson_theme');
        if (!sel) return;
        const builtOpts = BUILT_IN_THEMES.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        const custom = getSettings().customThemes || [];
        const customOpts = custom.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        sel.innerHTML = builtOpts + customOpts;
        sel.value = getSettings().theme || 'user';
    };

    window.larson_renderSettingsCustomThemes = function () {
        const list = document.getElementById('larson_custom_themes_list');
        if (!list) return;
        list.innerHTML = '';
        (getSettings().customThemes || []).forEach(ct => {
            const colors = ct.colors || [];
            const c1 = colors[0] || '#7c3aed', c2 = colors[1] || '#a855f7', c3 = colors[2] || '#c084fc';
            const item = document.createElement('div');
            item.className = 'larson_custom_theme_item_settings';
            item.innerHTML = `
                <span class="larson_custom_theme_item_name" title="${(ct.name || '').replace(/"/g, '&quot;')}">${ct.name || 'Unnamed'}</span>
                <div class="larson_mini_bar">
                    <span style="background:${c1}"></span><span style="background:${c2}"></span><span style="background:${c3}"></span>
                </div>
                <div class="larson_custom_theme_item_actions">
                    <button type="button" class="larson_custom_theme_btn_sm larson_edit_theme" data-id="${ct.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="larson_custom_theme_btn_sm larson_btn_delete larson_delete_theme" data-id="${ct.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            item.querySelector('.larson_edit_theme').addEventListener('click', function () { openThemeModal(ct.id); });
            item.querySelector('.larson_delete_theme').addEventListener('click', function () { confirmDeleteCustomTheme(ct.id, ct.name); });
            list.appendChild(item);
        });
    };

    function bindSettingsPanelEvents() {
        const panel = document.querySelector('.larson_settings');
        if (!panel) return;
        const s = getSettings();

        const byId = function (id) { return document.getElementById(id); };

        const onEnabled = function () {
            const el = byId('larson_enabled');
            if (el) { s.enabled = el.checked; saveSettings(); applyBarStyles(); }
        };
        const onHeight = function () {
            const el = byId('larson_bar_height');
            if (el) { s.bar_height = el.value; saveSettings(); applyBarStyles(); }
        };
        const onStyle = function () {
            const el = byId('larson_animation_style');
            if (el) { s.animation_style = el.value; saveSettings(); applyBarStyles(); }
        };
        const onSpeed = function () {
            const el = byId('larson_animation_speed');
            if (el) { s.animation_speed = el.value; saveSettings(); applyBarStyles(); }
        };
        const onTheme = function () {
            const el = byId('larson_theme');
            if (el) {
                s.theme = el.value;
                saveSettings();
                applyBarStyles();
            }
        };
        const onIdleEnabled = function () {
            const el = byId('larson_idle_enabled');
            if (el) {
                s.idle_animation_enabled = el.checked;
                saveSettings();
                // Enable/disable the idle dropdowns
                const idleStyle = byId('larson_idle_style');
                const idleSpeed = byId('larson_idle_speed');
                if (idleStyle) idleStyle.disabled = !el.checked;
                if (idleSpeed) idleSpeed.disabled = !el.checked;
                applyBarStyles();
            }
        };
        const onIdleStyle = function () {
            const el = byId('larson_idle_style');
            if (el) { s.idle_animation_style = el.value; saveSettings(); applyBarStyles(); }
        };
        const onIdleSpeed = function () {
            const el = byId('larson_idle_speed');
            if (el) { s.idle_animation_speed = el.value; saveSettings(); applyBarStyles(); }
        };
        const onThinkingEnabled = function () {
            const el = byId('larson_thinking_enabled');
            if (el) {
                s.thinking_animation_enabled = el.checked;
                saveSettings();
                // Enable/disable the thinking dropdowns
                const thinkingStyle = byId('larson_thinking_style');
                const thinkingSpeed = byId('larson_thinking_speed');
                if (thinkingStyle) thinkingStyle.disabled = !el.checked;
                if (thinkingSpeed) thinkingSpeed.disabled = !el.checked;
                // Show/hide the thinking warning
                const warning = byId('larson_thinking_warning');
                if (warning) warning.style.display = el.checked ? 'flex' : 'none';
                applyBarStyles();
            }
        };
        const onThinkingStyle = function () {
            const el = byId('larson_thinking_style');
            if (el) { s.thinking_animation_style = el.value; saveSettings(); applyBarStyles(); }
        };
        const onThinkingSpeed = function () {
            const el = byId('larson_thinking_speed');
            if (el) { s.thinking_animation_speed = el.value; saveSettings(); applyBarStyles(); }
        };
        const onHideWhenIdle = function () {
            const el = byId('larson_hide_when_idle');
            if (el) { s.hide_when_idle = el.checked; saveSettings(); applyBarStyles(); }
        };
        if (byId('larson_enabled')) byId('larson_enabled').addEventListener('change', onEnabled);
        if (byId('larson_bar_height')) byId('larson_bar_height').addEventListener('change', onHeight);
        if (byId('larson_animation_style')) byId('larson_animation_style').addEventListener('change', onStyle);
        if (byId('larson_animation_speed')) byId('larson_animation_speed').addEventListener('change', onSpeed);
        if (byId('larson_theme')) byId('larson_theme').addEventListener('change', onTheme);
        if (byId('larson_idle_enabled')) byId('larson_idle_enabled').addEventListener('change', onIdleEnabled);
        if (byId('larson_idle_style')) byId('larson_idle_style').addEventListener('change', onIdleStyle);
        if (byId('larson_idle_speed')) byId('larson_idle_speed').addEventListener('change', onIdleSpeed);
        if (byId('larson_thinking_enabled')) byId('larson_thinking_enabled').addEventListener('change', onThinkingEnabled);
        if (byId('larson_thinking_style')) byId('larson_thinking_style').addEventListener('change', onThinkingStyle);
        if (byId('larson_thinking_speed')) byId('larson_thinking_speed').addEventListener('change', onThinkingSpeed);
        if (byId('larson_hide_when_idle')) byId('larson_hide_when_idle').addEventListener('change', onHideWhenIdle);

        const addBtn = byId('larson_add_custom_theme');
        if (addBtn) {
            log('Settings panel add theme button found, attaching events');

            const openModal = function (e) {
                log('Settings add theme button clicked/tapped');
                if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                }
                openThemeModal(null);
            };

            // Mouse/pointer events
            addBtn.addEventListener('click', openModal, false);

            // Touch events for mobile
            let touchStarted = false;
            addBtn.addEventListener('touchstart', function (e) {
                touchStarted = true;
                log('Touch start on settings add theme button');
            }, { passive: true });

            addBtn.addEventListener('touchend', function (e) {
                if (touchStarted) {
                    log('Touch end on settings add theme button - opening modal');
                    e.stopPropagation();
                    e.preventDefault();
                    touchStarted = false;
                    openThemeModal(null);
                }
            }, { passive: false });
        } else {
            log('Settings panel add theme button NOT found');
        }

        // Modal is created in createThemeModal() and appended to body; events are bound there.
        // No need to bind again here - modal is shared.
    }

    // Sync settings panel inputs with current settings
    function applySettingsToUI() {
        const panel = document.querySelector('.larson_settings');
        // Only run if settings panel exists in DOM
        if (!panel) return;

        const s = getSettings();
        const byId = function (id) { return document.getElementById(id); };

        const setChecked = function (id, val) { const el = byId(id); if (el) el.checked = !!val; };
        const setVal = function (id, val, def) { const el = byId(id); if (el) el.value = val || def; };
        const setDisabled = function (id, disabled) { const el = byId(id); if (el) el.disabled = !!disabled; };

        // Global
        setChecked('larson_enabled', s.enabled);
        setVal('larson_bar_height', s.bar_height, 'default');

        // Animation
        setVal('larson_animation_style', s.animation_style, 'gradient');
        setVal('larson_animation_speed', s.animation_speed, 'normal');

        // Idle
        setChecked('larson_idle_enabled', s.idle_animation_enabled);
        setVal('larson_idle_style', s.idle_animation_style, 'breathe');
        setVal('larson_idle_speed', s.idle_animation_speed, 'normal');
        setDisabled('larson_idle_style', !s.idle_animation_enabled);
        setDisabled('larson_idle_speed', !s.idle_animation_enabled);

        // Thinking
        setChecked('larson_thinking_enabled', s.thinking_animation_enabled);
        setVal('larson_thinking_style', s.thinking_animation_style, 'gradient');
        setVal('larson_thinking_speed', s.thinking_animation_speed, 'normal');
        setDisabled('larson_thinking_style', !s.thinking_animation_enabled);
        setDisabled('larson_thinking_speed', !s.thinking_animation_enabled);

        // Thinking warning
        const warning = byId('larson_thinking_warning');
        if (warning) warning.style.display = s.thinking_animation_enabled ? 'flex' : 'none';

        // Update hidden theme select
        setVal('larson_theme', s.theme, 'sillytavern');

        // Refresh custom theme selection UI
        if (typeof window.larson_refreshThemeSelect === 'function') {
            window.larson_refreshThemeSelect();
        }
    }

    async function initSettingsPanel() {
        const maxRetries = 20;
        let attempts = 0;
        while (attempts < maxRetries) {
            try {
                const container = document.getElementById('extensions_settings');
                if (!container) {
                    attempts++;
                    await new Promise(function (r) { setTimeout(r, 300); });
                    continue;
                }
                let url;
                if (BASE_URL.indexOf('http') === 0) {
                    url = BASE_URL + '/settings.html';
                } else {
                    const base = BASE_URL.startsWith('/') ? BASE_URL : '/' + BASE_URL;
                    url = window.location.origin + base + '/settings.html';
                }
                const response = await fetch(url);
                if (!response.ok) {
                    warn('Failed to fetch settings.html:', response.status, response.statusText);
                    return;
                }
                const html = await response.text();
                container.insertAdjacentHTML('beforeend', html);
                bindSettingsPanelEvents();
                if (typeof window.larson_refreshThemeSelect === 'function') window.larson_refreshThemeSelect();
                if (typeof window.larson_renderSettingsCustomThemes === 'function') window.larson_renderSettingsCustomThemes();
                await setupThemeDropdown();
                applySettingsToUI();
                log('Settings panel loaded');
                return;
            } catch (err) {
                warn('Failed to load settings panel:', err);
                attempts++;
                if (attempts < maxRetries) {
                    await new Promise(function (r) { setTimeout(r, 300); });
                }
            }
        }
    }

    window.larson_cleanup = function () {
        unregisterEvents();
        document.removeEventListener('click', closeDropdownOnClick);
        if (optionsModalEscapeHandler) {
            document.removeEventListener('keydown', optionsModalEscapeHandler);
            optionsModalEscapeHandler = null;
        }
        if (overlayEl && overlayEl.parentNode) overlayEl.remove();
        if (barEl && barEl.parentNode) barEl.remove();
        const modal = document.getElementById('larson_theme_modal_overlay');
        if (modal && modal.parentNode) modal.remove();
        barEl = null;
        overlayEl = null;
        dropdownEl = null;
        document.querySelectorAll('.larson_settings').forEach(el => el.remove());
    };

    async function setupThemeDropdown() {
        // Populate custom theme dropdown
        const themeButton = document.getElementById('larson_theme_select_button');
        const themeDropdown = document.getElementById('larson_theme_dropdown');
        const themeCurrent = document.getElementById('larson_theme_select_current');
        const themeSelect = document.getElementById('larson_theme');

        if (!themeButton || !themeDropdown || !themeSelect) return;

        // Get all themes
        const allThemes = getAllThemes();
        const currentTheme = getSettings().theme || 'sillytavern';

        // Populate hidden select for compatibility
        themeSelect.innerHTML = '';
        allThemes.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme.id;
            option.textContent = theme.name;
            if (theme.id === currentTheme) option.selected = true;
            themeSelect.appendChild(option);
        });

        // Populate custom dropdown
        function populateThemeDropdown() {
            themeDropdown.innerHTML = '';
            const currentThemeId = getSettings().theme || 'sillytavern';

            allThemes.forEach(theme => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'larson_theme_dropdown_item';
                if (theme.id === currentThemeId) item.classList.add('active');
                item.dataset.themeId = theme.id;

                let contentHtml = '';
                if (theme.id === 'sillytavern') {
                    contentHtml = `
                        <span class="larson_theme_dropdown_name">${theme.name}</span>
                        <div class="larson_theme_st_info">Uses UI Theme Colors</div>
                    `;
                } else {
                    const colors = theme.colors || [];
                    const c1 = colors[0] || '#7c3aed';
                    const c2 = colors[1] || '#a855f7';
                    const c3 = colors[2] || '#c084fc';
                    const c4 = colors[3] || '#d8b4fe';

                    const swatchesHtml = colors.length >= 4
                        ? `<span style="background:${c1}"></span><span style="background:${c2}"></span><span style="background:${c3}"></span><span style="background:${c4}"></span>`
                        : colors.length >= 3
                            ? `<span style="background:${c1}"></span><span style="background:${c2}"></span><span style="background:${c3}"></span>`
                            : `<span style="background:${c1}"></span>`;

                    contentHtml = `
                        <span class="larson_theme_dropdown_name">${theme.name}</span>
                        <div class="larson_theme_dropdown_swatches">${swatchesHtml}</div>
                    `;
                }

                item.innerHTML = contentHtml;

                item.addEventListener('click', function () {
                    // Update settings
                    settings.theme = theme.id;
                    getSettings().theme = theme.id;
                    saveSettings();
                    applyBarStyles();

                    // Update UI
                    updateCurrentTheme(theme);
                    themeSelect.value = theme.id;

                    // Update active state
                    themeDropdown.querySelectorAll('.larson_theme_dropdown_item').forEach(i => {
                        i.classList.toggle('active', i.dataset.themeId === theme.id);
                    });

                    // Close dropdown
                    themeDropdown.style.display = 'none';
                    themeButton.setAttribute('aria-expanded', 'false');
                });

                themeDropdown.appendChild(item);
            });
        }

        // Update current theme display
        function updateCurrentTheme(theme) {
            if (theme.id === 'sillytavern') {
                themeCurrent.innerHTML = `
                    <span class="larson_theme_select_name">${theme.name}</span>
                    <div class="larson_theme_st_info">Uses UI Theme Colors</div>
                `;
            } else {
                const colors = theme.colors || [];
                const c1 = colors[0] || '#7c3aed';
                const c2 = colors[1] || '#a855f7';
                const c3 = colors[2] || '#c084fc';
                const c4 = colors[3] || '#d8b4fe';

                const swatchesHtml = colors.length >= 4
                    ? `<span style="background:${c1}"></span><span style="background:${c2}"></span><span style="background:${c3}"></span><span style="background:${c4}"></span>`
                    : colors.length >= 3
                        ? `<span style="background:${c1}"></span><span style="background:${c2}"></span><span style="background:${c3}"></span>`
                        : `<span style="background:${c1}"></span>`;

                themeCurrent.innerHTML = `
                    <span class="larson_theme_select_name">${theme.name}</span>
                    <div class="larson_theme_select_swatches">${swatchesHtml}</div>
                `;
            }
        }

        // Toggle dropdown
        themeButton.addEventListener('click', function () {
            const isOpen = themeDropdown.style.display === 'block';
            themeDropdown.style.display = isOpen ? 'none' : 'block';
            themeButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            if (!isOpen) populateThemeDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (!themeButton.contains(e.target) && !themeDropdown.contains(e.target)) {
                themeDropdown.style.display = 'none';
                themeButton.setAttribute('aria-expanded', 'false');
            }
        });

        // Initialize current theme display
        const currentThemeObj = allThemes.find(t => t.id === currentTheme);
        if (currentThemeObj) updateCurrentTheme(currentThemeObj);

        populateThemeDropdown();

        // Expose function to refresh theme select when ST theme changes
        window.larson_refreshThemeSelect = function () {
            const currentThemeId = getSettings().theme || 'sillytavern';
            const currentThemeObj = getAllThemes().find(t => t.id === currentThemeId);
            if (currentThemeObj) {
                // If sillytavern theme, refresh colors from current ST theme
                if (currentThemeId === 'sillytavern') {
                    currentThemeObj.colors = getUserThemeColors();
                }
                updateCurrentTheme(currentThemeObj);
                populateThemeDropdown();
            }
        };
    }

    async function init() {
        if (typeof SillyTavern === 'undefined' || !SillyTavern.getContext) {
            setTimeout(init, 500);
            return;
        }
        const ctx = getContext();
        if (!ctx || !ctx.extensionSettings) {
            setTimeout(init, 500);
            return;
        }
        try {
            loadSettings();
            if (document.body) {
                createThemeModal();
                createBar();
                setTimeout(createBar, 800);
                setTimeout(createBar, 2000);
            }
            registerEvents();
            await initSettingsPanel();

            // Monkey-patch toastr.error for visual feedback on generation errors
            if (typeof toastr !== 'undefined') {
                const originalError = toastr.error;
                toastr.error = function (message, title, options) {
                    if (barEl) barEl.classList.add('larson_error');
                    return originalError.apply(this, arguments);
                };
            }

            // Clear error state on new generation
            const ctx = getContext();
            if (ctx.eventSource) {
                const clearError = () => { if (barEl) barEl.classList.remove('larson_error'); };
                if (ctx.event_types) {
                    ctx.eventSource.on(ctx.event_types.GENERATION_STARTED, clearError);
                    ctx.eventSource.on(ctx.event_types.GENERATION_AFTER_COMMANDS, clearError);
                }
            }

            log('Larson initialized');
        } catch (err) {
            error('Larson init failed:', err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
