figma.showUI(__html__, { themeColors: true, width: 340, height: 580 });

async function sendFontData() {
    try {
        const fonts = await figma.listAvailableFontsAsync();
        const fontMap = {};
        fonts.forEach(f => {
            if (!fontMap[f.fontName.family]) {
                fontMap[f.fontName.family] = [];
            }
            fontMap[f.fontName.family].push(f.fontName.style);
        });
        figma.ui.postMessage({ type: 'font-data', fontMap });
    } catch (e) {
        console.error("Error sending font data:", e);
    }
}

// Color Helper Functions
function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    let rgb = parseInt(c, 16);
    return {
        r: ((rgb >> 16) & 0xff),
        g: ((rgb >> 8) & 0xff),
        b: ((rgb >> 0) & 0xff)
    };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToRgbFigma(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r, g, b };
}

function generateColorScale(baseHex) {
    const baseRgb = hexToRgb(baseHex);
    const { h, s, l } = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);

    // Smooth interpolations
    const scale = {
        50: { h, s, l: 0.96 },
        100: { h, s, l: 0.90 },
        200: { h, s, l: 0.80 },
        300: { h, s, l: 0.70 },
        400: { h, s, l: Math.min(0.60, l + (0.96 - l) * 0.2) },
        500: { h, s, l }, // Base
        600: { h, s, l: l * 0.85 },
        700: { h, s, l: l * 0.65 },
        800: { h, s, l: l * 0.45 },
        900: { h, s, l: l * 0.25 },
    };

    const result = {};
    for (const key in scale) {
        result[key] = hslToRgbFigma(scale[key].h, scale[key].s, scale[key].l);
    }
    return result;
}

figma.ui.onmessage = async (msg) => {
    if (msg.type === 'ui-ready') {
        await sendFontData();
    } else if (msg.type === 'generate-system') {
        const { colors, includeNeutral, font, allCategories } = msg;
        try {
            await runGenerator(colors, includeNeutral, font, allCategories);
            figma.ui.postMessage({ type: 'done' });
        } catch (err) {
            figma.ui.postMessage({ type: 'error', message: err.message || 'An error occurred' });
        }
    } else if (msg.type === 'request-font-data') {
        await sendFontData();
    }
};

async function runGenerator(colors, includeNeutral, font, allCategories) {
    if (!allCategories) allCategories = [];
    // 1. Create color scales
    const allScales = {};
    for (const [name, hex] of Object.entries(colors)) {
        allScales[name] = generateColorScale(hex);
    }

    if (includeNeutral) {
        allScales["Neutral"] = {
            "White": { r: 1, g: 1, b: 1 },
            "Black": { r: 0, g: 0, b: 0 }
        };
    }

    // Create Local Collection
    let varCollection = figma.variables.getLocalVariableCollections().find(c => c.name === "Design System");
    if (!varCollection) {
        varCollection = figma.variables.createVariableCollection("Design System");
    }
    const modeId = varCollection.modes[0].modeId;

    // Cleanup: Remove styles and variables for categories that are NOT selected
    const categories = allCategories.length > 0 ? allCategories : ["Primary", "Secondary", "Tertiary", "Success", "Info", "Warning", "Danger", "Gray", "Others", "Neutral"];
    const selectedCategories = Object.keys(allScales);
    const unselectedCategories = categories.filter(c => !selectedCategories.includes(c));

    // Cache existing styles and variables for O(1) lookup
    const existingStyles = new Map(figma.getLocalPaintStyles().map(s => [s.name, s]));
    const existingVars = new Map(figma.variables.getLocalVariables().filter(v => v.variableCollectionId === varCollection.id).map(v => [v.name, v]));

    // Remove unselected styles
    existingStyles.forEach((style, name) => {
        const styleCategory = name.split('/')[0].trim();
        if (unselectedCategories.includes(styleCategory)) {
            style.remove();
            existingStyles.delete(name);
        }
    });

    // Remove unselected variables
    existingVars.forEach((v, name) => {
        const varCategory = name.split('/')[0].trim();
        if (unselectedCategories.includes(varCategory)) {
            v.remove();
            existingVars.delete(name);
        }
    });

    // Save colors as styles and variables
    const savedVariables = {};

    for (const [name, scale] of Object.entries(allScales)) {
        savedVariables[name] = {};
        for (const [shade, rgb] of Object.entries(scale)) {
            const styleName = `${name}/${shade}`;
            // Create Style
            let paintStyle = existingStyles.get(styleName);
            if (!paintStyle) {
                paintStyle = figma.createPaintStyle();
                paintStyle.name = styleName;
            }
            paintStyle.paints = [{ type: 'SOLID', color: rgb }];

            // Create Variable
            let colorVar = existingVars.get(styleName);
            if (!colorVar) {
                colorVar = figma.variables.createVariable(styleName, varCollection.id, 'COLOR');
            }
            colorVar.setValueForMode(modeId, { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 });
            
            savedVariables[name][shade] = colorVar;
        }
    }
    const colorScale = allScales['Primary']; // Backward compatibility for initial component building

    const s = 16;
    const headingWeight = "Bold";

    // Ensure fonts are loaded before setting style
    const weights = ['Regular', 'Bold'];
    for (const w of weights) {
        try { await figma.loadFontAsync({ family: "Inter", style: w }); } catch (e) { }
    }

    const loadedWeights = [];
    for (const w of weights) {
        try {
            await figma.loadFontAsync({ family: font, style: w });
            loadedWeights.push(w);
        } catch (e) {
            // Fallback for this specific weight
            try {
                await figma.loadFontAsync({ family: font, style: "Regular" });
                if (!loadedWeights.includes("Regular")) loadedWeights.push("Regular");
            } catch (e2) {}
        }
    }

    if (loadedWeights.length === 0) {
        font = "Inter";
    }

    const typoConfig = [
        { name: "Display/Large", size: 57, weight: "Bold" },
        { name: "Display/Medium", size: 45, weight: "Bold" },
        { name: "Display/Small", size: 36, weight: "Bold" },
        { name: "Heading/H1", size: 32, weight: "Bold" },
        { name: "Heading/H2", size: 28, weight: "Bold" },
        { name: "Heading/H3", size: 24, weight: "Bold" },
        { name: "Heading/H4", size: 20, weight: "Bold" },
        { name: "Heading/H5", size: 16, weight: "Bold" },
        { name: "Heading/H6", size: 14, weight: "Bold" },
        { name: "Body/Large", size: 16, weight: "Regular" },
        { name: "Body/Medium", size: 14, weight: "Regular" },
        { name: "Body/Small", size: 12, weight: "Regular" }
    ];

    for (const t of typoConfig) {
        let textStyle = figma.getLocalTextStyles().find(s => s.name === t.name);
        if (!textStyle) {
            textStyle = figma.createTextStyle();
            textStyle.name = t.name;
        }
        
        let styleToUse = t.weight;
        if (loadedWeights.indexOf(styleToUse) === -1) {
            styleToUse = (loadedWeights.indexOf("Regular") !== -1) ? "Regular" : (loadedWeights[0] || "Regular");
        }

        textStyle.fontName = { family: font, style: styleToUse };
        textStyle.fontSize = t.size;
        textStyle.lineHeight = { unit: 'AUTO' };
        textStyle.letterSpacing = { value: 0, unit: 'PIXELS' };
    }

    // 3. Spacing Variables
    const spacingScale = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];
    for (const val of spacingScale) {
        let spcVar = figma.variables.getLocalVariables().find(v => v.name === `Spacing/${val}` && v.variableCollectionId === varCollection.id);
        if (!spcVar) {
            spcVar = figma.variables.createVariable(`Spacing/${val}`, varCollection.id, 'FLOAT');
        }
        spcVar.setValueForMode(modeId, val);
    }

    figma.notify("Design System Tokens Generated Successfully!");
}
