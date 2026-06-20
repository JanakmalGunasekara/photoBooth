import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import chokidar from 'chokidar';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import multer from 'multer';
import os from 'os';

// --- Setup __dirname equivalent for ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. Initialize Express ---
const app = express();
const PORT = 5000;
app.use(cors());
app.use(express.json());

// --- 2. Define folder paths and ensure they exist ---
const cameraFolder = path.join(__dirname, 'camera_folder');
const templatesFolder = path.join(__dirname, 'templates');
const outputsFolder = path.join(__dirname, 'outputs');
const configFilePath = path.join(__dirname, 'config.json');

[cameraFolder, templatesFolder, outputsFolder].forEach(folder => {
    if (!fs.existsSync(folder)) {
        console.log(`Creating directory: ${folder}`);
        fs.mkdirSync(folder, { recursive: true });
    }
});

// --- In-memory store for template configurations (can be replaced by reading config.json) ---
let templateConfigs = {};
// Load existing config on startup
if (fs.existsSync(configFilePath)) {
    try {
        const data = fs.readFileSync(configFilePath, 'utf8');
        templateConfigs = JSON.parse(data);
        console.log('Loaded template configurations from config.json');
    } catch (err) {
        console.error('Error reading config.json:', err);
    }
}

// --- Default configuration for the main template to prevent errors on first run ---
const DEFAULT_TEMPLATE_CONFIG = {
    'temp_1.png': {
        areas: [{ x: 100, y: 100, width: 1000, height: 1000 }],
        texts: [{ id: 'title', text: 'Happy Wedding', x: 600, y: 1300, fontSize: 80, color: '#000000', fontFamily: 'Cursive' }]
    },
    'temp_1.jpg': {
        areas: [{ x: 100, y: 100, width: 1000, height: 1000 }],
        texts: [{ id: 'title', text: 'Happy Wedding', x: 600, y: 1300, fontSize: 80, color: '#000000', fontFamily: 'Cursive' }]
    },
    'temp_2.png': {
        areas: [{ x: 100, y: 100, width: 1000, height: 700 }, { x: 100, y: 850, width: 1000, height: 700 }],
        texts: [{ id: 'title', text: 'Sweet Memories', x: 600, y: 1650, fontSize: 70, color: '#000000', fontFamily: 'Arial' }]
    },
    'temp_2.jpg': {
        areas: [{ x: 100, y: 100, width: 1000, height: 700 }, { x: 100, y: 850, width: 1000, height: 700 }],
        texts: [{ id: 'title', text: 'Sweet Memories', x: 600, y: 1650, fontSize: 70, color: '#000000', fontFamily: 'Arial' }]
    },
    'temp_3.png': {
        areas: [{ x: 100, y: 100, width: 480, height: 600 }, { x: 620, y: 100, width: 480, height: 600 }, { x: 100, y: 750, width: 1000, height: 700 }],
        texts: [{ id: 'title', text: 'Thank You!', x: 600, y: 1600, fontSize: 80, color: '#000000', fontFamily: 'Times New Roman' }]
    },
    'temp_3.jpg': {
        areas: [{ x: 100, y: 100, width: 480, height: 600 }, { x: 620, y: 100, width: 480, height: 600 }, { x: 100, y: 750, width: 1000, height: 700 }],
        texts: [{ id: 'title', text: 'Thank You!', x: 600, y: 1600, fontSize: 80, color: '#000000', fontFamily: 'Times New Roman' }]
    }
};

const getDisplayText = (t) => {
    const lines = (t.text || '').split('\n');
    const toRoman = (num) => {
        const lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
        let roman = '', i;
        for (i in lookup) { while (num >= lookup[i]) { roman += i; num -= lookup[i]; } }
        return roman;
    };
    return lines.map((line, idx) => {
        if (t.listType === 'bullet') return `• ${line}`;
        if (t.listType === 'circle') return `◦ ${line}`;
        if (t.listType === 'square') return `■ ${line}`;
        if (t.listType === 'star') return `★ ${line}`;
        if (t.listType === 'number') return `${idx + 1}. ${line}`;
        if (t.listType === 'roman_lower') return `${toRoman(idx + 1).toLowerCase()}. ${line}`;
        if (t.listType === 'roman_upper') return `${toRoman(idx + 1)}. ${line}`;
        return line;
    });
};

// --- Helper for Overlaying SVG Text ---
const buildTextOverlay = (texts, width, height) => {
    if (!texts || texts.length === 0) return null;
    let svgContent = `<svg width="${width}" height="${height}">`;
    
    // 1. Generate Definitions for Gradients
    svgContent += `<defs>`;
    for (const t of texts) {
        if (t.fillType === 'gradient') {
            const angle = t.gradientAngle || 90;
            const x1 = Math.round(50 + Math.cos((angle - 180) * Math.PI / 180) * 50);
            const y1 = Math.round(50 + Math.sin((angle - 180) * Math.PI / 180) * 50);
            const x2 = Math.round(50 + Math.cos(angle * Math.PI / 180) * 50);
            const y2 = Math.round(50 + Math.sin(angle * Math.PI / 180) * 50);
            svgContent += `<linearGradient id="grad_${t.id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
                              <stop offset="0%" stop-color="${t.color || '#000'}" />
                              <stop offset="100%" stop-color="${t.color2 || '#fff'}" />
                           </linearGradient>`;
        }
    }
    svgContent += `</defs>`;

    for (const t of texts) {
        const fontFamily = t.fontFamily || 'Arial';
        const align = t.textAlign || 'center';
        let textAnchor = 'middle';
        if (align === 'left') textAnchor = 'start';
        else if (align === 'right') textAnchor = 'end';
        
        const letterSpacing = t.letterSpacing || 0;
        const lineHeight = t.lineHeight || 1.2;
        const fw = t.fontWeight === 'normal' ? 'normal' : 'bold';
        const fs_style = t.fontStyle || 'normal';
        const td = t.textDecoration || 'none';
        const size = t.fontSize || 50;
        const lines = getDisplayText(t);
        const effects = t.effects || {};

        const drawTextLayer = (fill, stroke, strokeWidth, dx, dy) => {
            let layerContent = `<text x="${t.x + dx}" y="${t.y + dy}" font-size="${size}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" font-family="${fontFamily}" font-weight="${fw}" font-style="${fs_style}" text-decoration="${td}" text-anchor="${textAnchor}" dominant-baseline="middle" letter-spacing="${letterSpacing}px">`;
            for (let i = 0; i < lines.length; i++) {
                const safeText = lines[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
                layerContent += `<tspan x="${t.x + dx}" dy="${i === 0 ? '0' : `${lineHeight}em`}">${safeText}</tspan>`;
            }
            layerContent += `</text>`;
            return layerContent;
        };

        let nodeContent = '';
        let finalFill = t.fillType === 'gradient' ? `url(#grad_${t.id})` : (t.color || '#000000');
        let mainStroke = 'none';
        let mainStrokeWidth = 0;

        // Render Base Background if enabled
        if (effects.background?.enabled) {
            const bgC = effects.background.color ?? '#ffff00';
            nodeContent += `<filter id="bg_${t.id}" x="-10%" y="-10%" width="120%" height="120%"><feFlood flood-color="${bgC}" result="bg" /><feMerge><feMergeNode in="bg"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
            // The text element later will need filter="url(#bg_id)"
        }

        // Render Effects layers (Back to Front)
        if (effects.echo?.enabled) { 
            const d1 = effects.echo.distance ?? 5; 
            const r = (effects.echo.angle ?? 45) * Math.PI / 180;
            const c = effects.echo.color ?? '#000000';
            nodeContent += drawTextLayer('rgba(0,0,0,0.4)', 'none', 0, Math.cos(r)*d1*2, Math.sin(r)*d1*2); 
            nodeContent += drawTextLayer(c, 'none', 0, Math.cos(r)*d1, Math.sin(r)*d1); 
        }
        if (effects.drop?.enabled) { 
            const d = effects.drop.distance ?? 5;
            const r = (effects.drop.angle ?? 45) * Math.PI / 180;
            const c = effects.drop.color ?? '#000000';
            nodeContent += drawTextLayer(c, 'none', 0, Math.cos(r)*d, Math.sin(r)*d); 
        }
        if (effects.glow?.enabled) { 
            const intensity = effects.glow.intensity ?? 10;
            const c = effects.glow.color ?? '#ff0000';
            nodeContent += drawTextLayer(c, c, intensity, 0, 0); 
        }
        if (effects.splice?.enabled) { 
            const d = effects.splice.distance ?? 5;
            const r = (effects.splice.angle ?? 45) * Math.PI / 180;
            const c = effects.splice.color ?? '#000000';
            const thick = effects.splice.thickness ?? 2;
            nodeContent += drawTextLayer(c, 'none', 0, Math.cos(r)*d, Math.sin(r)*d); 
            mainStroke = t.color || '#000'; mainStrokeWidth = thick; finalFill = 'none';
        }
        if (effects.neon?.enabled) { 
            const c = effects.neon.color ?? '#ff00ff';
            nodeContent += drawTextLayer(c, c, size*0.1, 0, 0); 
            nodeContent += drawTextLayer(c, c, size*0.05, 0, 0); 
            finalFill = '#ffffff'; 
        }
        if (effects.glitch?.enabled) { 
            nodeContent += drawTextLayer('cyan', 'none', 0, size*0.04, 0); 
            nodeContent += drawTextLayer('red', 'none', 0, -size*0.04, 0); 
        }
        
        if (effects.outline?.enabled && !effects.hollow?.enabled && !effects.splice?.enabled) {
            const c = effects.outline.color ?? '#000000';
            const thick = effects.outline.thickness ?? 2;
            nodeContent += drawTextLayer(c, c, thick, 0, 0); 
        }
        if (effects.hollow?.enabled) {
            mainStroke = t.color || '#000'; mainStrokeWidth = effects.hollow.thickness ?? 2; finalFill = 'none';
        }

        // Main Text Layer
        let txt = drawTextLayer(finalFill, mainStroke, mainStrokeWidth, 0, 0);
        if (effects.background?.enabled) {
            let txt = drawTextLayer(finalColor, 'none', 0, 0, 0);
            txt = txt.replace('<text ', `<text filter="url(#bg_${t.id})" `);
        }
        nodeContent += txt;

        svgContent += `<g id="${t.id}">${nodeContent}</g>`;
    }
    svgContent += `</svg>`;
    return Buffer.from(svgContent);
};


// --- 3. Serve folders as static assets ---
app.use('/photos', express.static(cameraFolder));
app.use('/outputs', express.static(outputsFolder));
app.use('/templates', express.static(templatesFolder));

// Handle browser requests for favicon.ico to prevent 404 errors in the console.
app.get('/favicon.ico', (req, res) => res.status(204).send());

// --- Multer Setup for Template Uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, templatesFolder),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage: storage });

// --- 4. Set up HTTP server and Socket.io ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173", // React App URL
        methods: ["GET", "POST"]
    }
});

let watcher = null;
let recentPhotos = [];
let lastSessionUpdate = Date.now(); // To strictly track array updates

function startWatcher(folderPath) {
    if (watcher) {
        console.log('Stopping previous file watcher...');
        watcher.close();
    }

    if (!fs.existsSync(folderPath)) {
        console.error(`Error: The specified camera folder does not exist: ${folderPath}`);
        console.log('File watcher not started. Please set a valid camera folder path in Setup Mode.');
        return;
    }

    console.log(`Starting to watch for new photos in: ${folderPath}`);
    watcher = chokidar.watch(folderPath, {
        ignoreInitial: true,
        usePolling: true,
        interval: 500,
        awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100
        },
        ignorePermissionErrors: true // Prevents crashes on restricted system folders
    }).on('all', (event, filePath) => {
        if (event !== 'add' && event !== 'change') return;
        const fileName = path.basename(filePath);
        
        // Ignore non-image files (like temporary files created by camera software)
        if (!/\.(jpe?g|png)$/i.test(fileName)) {
            return;
        }
        
        console.log(`📸 New photo detected: ${fileName}`);

        // Copy the file to the internal 'camera_folder' to be served statically
        const destinationPath = path.join(cameraFolder, fileName);
        
        const handleSuccessfulAdd = (name) => {
            // Remove existing entry to prevent duplicates on 'change' event
            const existingIndex = recentPhotos.findIndex(p => p.name === name);
            if (existingIndex !== -1) {
                recentPhotos.splice(existingIndex, 1);
            }

            const newPhoto = {
                name: name,
                path: name,
                timestamp: Date.now()
            };
            recentPhotos.unshift(newPhoto);
            if (recentPhotos.length > 10) {
                recentPhotos.length = 10;
            }
            
            lastSessionUpdate = Date.now(); // Notify frontend that a change happened

            // Emit the event with the URL that points to the internal folder
            io.emit('NEW_PHOTO', {
                url: `http://localhost:${PORT}/photos/${name}`,
                name: name
            });
        };

        // Function to retry copying if the file is locked by the camera software
        const copyWithRetry = (src, dest, retries = 20, delay = 1000) => {
            if (path.resolve(src) === path.resolve(dest)) {
                console.log(`✅ File is already in the camera folder. Skipping copy.`);
                handleSuccessfulAdd(fileName);
                return;
            }

            fs.copyFile(src, dest, (err) => {
                if (err) {
                    if (retries > 0) {
                        console.log(`⏳ File might be locked, retrying in ${delay}ms... (${retries} attempts left)`);
                        setTimeout(() => copyWithRetry(src, dest, retries - 1, delay), delay);
                    } else {
                        console.error(`❌ Error copying file after retries: ${err}`);
                    }
                    return;
                }
                console.log(`✅ Copied ${fileName} to internal camera folder for serving.`);
                handleSuccessfulAdd(fileName);
            });
        };

        copyWithRetry(filePath, destinationPath);
    }).on('error', (error) => {
        console.error(`Watcher error (ignoring): ${error.message}`);
    });
}

// --- 6. GET endpoint to fetch installed Windows printers ---
app.get('/api/printers', (req, res) => {
    const command = 'powershell.exe -Command "Get-Printer | Select-Object -ExpandProperty Name"';
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error fetching printers: ${error.message}`);
            return res.status(500).json({ error: 'Failed to fetch printers.' });
        }
        if (stderr) console.error(`PowerShell stderr: ${stderr}`);
        const printers = stdout.split(/\r?\n/).filter(p => p.trim() !== '');
        res.json(printers);
    });
});

// --- NEW: GET endpoint to list available templates ---
app.get('/api/templates', (req, res) => {
    fs.readdir(templatesFolder, (err, files) => {
        if (err) {
            console.error("Could not list the templates directory.", err);
            return res.status(500).json({ error: 'Failed to read templates directory.' });
        }
        const imageFiles = files.filter(file => /\.(jpe?g|png)$/i.test(file));
        res.json(imageFiles);
    });
});

// --- NEW: POST endpoint to upload a new template ---
app.post('/api/templates/upload', upload.single('template'), (req, res) => {
    res.status(200).json({ success: true, message: `Template '${req.file.filename}' uploaded successfully.` });
});

// --- UPDATED: POST endpoint to save configuration ---
app.post('/api/config', (req, res) => {
    templateConfigs = req.body;
    // Persist to file
    fs.writeFile(configFilePath, JSON.stringify(templateConfigs, null, 2), (err) => {
        if (err) {
            console.error('Error writing to config.json:', err);
            return res.status(500).json({ error: 'Failed to save configuration file.' });
        }
        console.log(`Configuration saved.`);
        res.status(200).json({ success: true, message: `Configuration saved.` });
    });
});

// --- NEW: Endpoint to set the camera folder path ---
app.post('/api/camera-folder', (req, res) => {
    const { folderPath } = req.body;
    if (!folderPath) {
        return res.status(400).json({ error: 'folderPath is required.' });
    }

    if (!fs.existsSync(folderPath)) {
        return res.status(400).json({ error: `The specified folder does not exist: ${folderPath}` });
    }

    templateConfigs.cameraFolderPath = folderPath;

    fs.writeFile(configFilePath, JSON.stringify(templateConfigs, null, 2), (err) => {
        if (err) {
            console.error('Error writing to config.json:', err);
            return res.status(500).json({ error: 'Failed to save configuration file.' });
        }
        console.log(`Camera folder path updated to: ${folderPath}`);
        startWatcher(folderPath); // Restart the watcher with the new path
        res.status(200).json({ success: true, message: `Camera folder path set to: ${folderPath}` });
    });
});

// --- NEW: GET endpoint to browse folder natively via backend (Windows only) ---
app.get('/api/browse-folder', (req, res) => {
    // This uses PowerShell to open a native Windows folder picker on top of other windows
    const command = `powershell.exe -NoProfile -Command "Add-Type -AssemblyName System.windows.forms; $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog; $folderBrowser.Description = 'Select Camera Output Folder'; $folderBrowser.RootFolder = [System.Environment+SpecialFolder]::MyComputer; $result = $folderBrowser.ShowDialog((New-Object System.Windows.Forms.Form -Property @{TopMost = $true})); if ($result -eq [System.Windows.Forms.DialogResult]::OK) { $folderBrowser.SelectedPath }"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error opening folder dialog: ${error.message}`);
            return res.status(500).json({ error: 'Failed to open folder dialog.' });
        }
        const selectedPath = stdout.trim();
        res.json({ selectedPath });
    });
});

// --- NEW: GET endpoint to list directories for web-based folder browser ---
app.get('/api/directories', (req, res) => {
    let targetDir = req.query.dir || os.homedir();
    
    try {
        // Fallback to homedir if the requested dir doesn't exist
        if (!fs.existsSync(targetDir)) {
            targetDir = os.homedir();
        }
        
        const items = fs.readdirSync(targetDir, { withFileTypes: true });
        // Get only directories, hide hidden folders (starting with .)
        const directories = items
            .filter(item => item.isDirectory() && !item.name.startsWith('.'))
            .map(item => item.name);
            
        const parentDir = path.resolve(targetDir, '..');
        res.json({ currentDir: targetDir, directories, parentDir });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read directory: ' + err.message });
    }
});

// --- NEW: DELETE endpoint to remove a template ---
app.delete('/api/templates/:templateName', (req, res) => {
    const { templateName } = req.params;

    // Security: Prevent path traversal attacks.
    if (templateName.includes('..') || templateName.includes('/') || templateName.includes('\\')) {
        return res.status(400).json({ error: 'Invalid template name.' });
    }

        // Security: Prevent deleting predefined default templates
        if (templateName.toLowerCase().startsWith('temp_') || templateName.toLowerCase().startsWith('default_')) {
            return res.status(403).json({ error: 'Default templates cannot be deleted.' });
        }

    const templatePath = path.join(templatesFolder, templateName);

    // 1. Delete the image file from the 'templates' folder.
    fs.unlink(templatePath, (err) => {
        if (err && err.code !== 'ENOENT') { // Ignore "file not found" errors, but log others.
            console.error(`Error deleting template file ${templatePath}:`, err);
            // We can still proceed to ensure the config is also cleaned up.
        }

        // 2. Delete the configuration entry from memory and the config.json file.
        if (templateConfigs[templateName]) {
            delete templateConfigs[templateName];
            fs.writeFile(configFilePath, JSON.stringify(templateConfigs, null, 2), (writeErr) => {
                if (writeErr) {
                    console.error('Error writing updated config.json:', writeErr);
                    return res.status(500).json({ error: 'Failed to update configuration file.' });
                }
                console.log(`Configuration and template file removed for ${templateName}.`);
                res.status(200).json({ success: true, message: `Template '${templateName}' deleted.` });
            });
        } else {
            res.status(200).json({ success: true, message: `Template '${templateName}' deleted (no config found).` });
        }
    });
});

// --- NEW: GET endpoint to fetch all template configurations ---
app.get('/api/config', (req, res) => {
    // Merge the predefined defaults with customized in-memory config
    const mergedConfig = { ...DEFAULT_TEMPLATE_CONFIG, ...templateConfigs };
    res.status(200).json(mergedConfig);
});

// --- NEW: GET endpoint for latest photo polling ---
app.get('/api/latest-photo', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.status(200).json({ recent: recentPhotos, lastUpdate: lastSessionUpdate });
});

// --- NEW: POST endpoint to clear recent photos for a new session ---
app.post('/api/clear-session', (req, res) => {
    recentPhotos = [];
    lastSessionUpdate = Date.now();
    res.status(200).json({ success: true, message: 'Recent photos cleared for new session.' });
});

// --- NEW: DELETE endpoint to remove a specific photo ---
app.delete('/api/photos/:photoName', (req, res) => {
    const { photoName } = req.params;
    
    // Security: Prevent path traversal attacks
    if (photoName.includes('..') || photoName.includes('/') || photoName.includes('\\')) {
        return res.status(400).json({ error: 'Invalid photo name.' });
    }

    const photoPath = path.join(cameraFolder, photoName);
    const originalPhotoPath = templateConfigs.cameraFolderPath ? path.join(templateConfigs.cameraFolderPath, photoName) : null;

    const existingIndex = recentPhotos.findIndex(p => p.name === photoName);
    if (existingIndex !== -1) {
        recentPhotos.splice(existingIndex, 1);
    }

    fs.unlink(photoPath, (err) => {
        if (err && err.code !== 'ENOENT') {
            console.error(`Error deleting photo file ${photoPath}:`, err);
        }
        
        if (originalPhotoPath && fs.existsSync(originalPhotoPath)) {
            fs.unlink(originalPhotoPath, (err2) => {
                if (err2) console.error(`Error deleting original photo ${originalPhotoPath}:`, err2);
            });
        }

        lastSessionUpdate = Date.now(); // Notify frontend
        console.log(`🗑️ Photo deleted: ${photoName}`);
        res.status(200).json({ success: true, message: `Photo '${photoName}' deleted.` });
    });
});

// --- UPDATED: POST endpoint for PREVIEWING a merged image (in-memory) ---
app.post('/api/merge', async (req, res) => {
    const { guestPhotoNames, templateName, positions } = req.body;

    if (!guestPhotoNames || !Array.isArray(guestPhotoNames) || guestPhotoNames.length === 0 || !templateName) {
        return res.status(400).json({ error: 'guestPhotoNames array and templateName are required.' });
    }

    // Retrieve the saved configuration for the template, with a fallback to the default
    let config = templateConfigs[templateName];
    if (!config) {
        console.log(`No custom config for ${templateName}, checking for default.`);
        config = DEFAULT_TEMPLATE_CONFIG[templateName];
    }

    if (!config) {
        return res.status(404).json({ error: `No configuration found for template: ${templateName}. Please use Setup Mode first.` });
    }

    // Normalize config to handle old single-area configs
    let areas = config.areas;
    if (!areas && config.x !== undefined) {
        areas = [{ x: config.x, y: config.y, width: config.width, height: config.height }];
    }

    if (!areas || areas.length === 0) {
         return res.status(400).json({ error: `Template configuration is invalid or missing selection areas.` });
    }

    const templatePath = path.join(templatesFolder, templateName);

    try {
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: 'Template not found for preview.' });
        }

        console.log(`Generating merge preview for ${guestPhotoNames.join(', ')}...`);

        const templateImage = sharp(templatePath);
        const templateMetadata = await templateImage.metadata();
        const templateStats = await templateImage.stats();
        const isOpaque = templateStats.isOpaque;

        const compositeOperations = [];
        if (isOpaque) compositeOperations.push({ input: templatePath, top: 0, left: 0 });

        const photosToMerge = guestPhotoNames.slice(0, areas.length);

        for (let i = 0; i < photosToMerge.length; i++) {
            const photoName = photosToMerge[i];
            const area = areas[i];
            const position = positions && positions[i] ? positions[i] : { x: 50, y: 50 };
            const resolvedGuestPhotoPath = path.join(cameraFolder, photoName);

            if (fs.existsSync(resolvedGuestPhotoPath)) {
                const imgMeta = await sharp(resolvedGuestPhotoPath).metadata();
                const imgW = imgMeta.width;
                const imgH = imgMeta.height;
                
                const S = Math.max(area.width / imgW, area.height / imgH);
                const scaledW = Math.round(imgW * S);
                const scaledH = Math.round(imgH * S);
                
                let extractX = Math.round(((scaledW - area.width) * position.x) / 100);
                let extractY = Math.round(((scaledH - area.height) * position.y) / 100);
                
                extractX = Math.max(0, Math.min(extractX, scaledW - Math.round(area.width)));
                extractY = Math.max(0, Math.min(extractY, scaledH - Math.round(area.height)));

                const guestPhotoBuffer = await sharp(resolvedGuestPhotoPath)
                    .resize({ width: scaledW, height: scaledH })
                    .extract({ left: extractX, top: extractY, width: Math.round(area.width), height: Math.round(area.height) })
                    .toBuffer();
                
                compositeOperations.push({ input: guestPhotoBuffer, top: Math.round(area.y), left: Math.round(area.x) });
            }
        }

        compositeOperations.push({ input: templatePath, top: 0, left: 0 });
        if (!isOpaque) compositeOperations.push({ input: templatePath, top: 0, left: 0 });

        const textOverlay = buildTextOverlay(config.texts, templateMetadata.width, templateMetadata.height);
        if (textOverlay) {
            compositeOperations.push({ input: textOverlay, top: 0, left: 0 });
        }

        const outputBuffer = await sharp({
            create: {
                width: templateMetadata.width,
                height: templateMetadata.height,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
            .composite(compositeOperations)
            .jpeg()
            .toBuffer();

        // Convert buffer to a Data URL to be displayed on the frontend without saving a file
        const outputUrl = `data:image/jpeg;base64,${outputBuffer.toString('base64')}`;

        res.status(200).json({
            success: true,
            message: 'Merge preview generated successfully.',
            outputUrl: outputUrl,
        });

    } catch (error) {
        console.error('--- IMAGE MERGE PREVIEW ERROR ---', error);
        console.error(error);
        res.status(500).json({ error: 'Image processing failed.', details: error.message });
    }
});

// --- NEW: POST endpoint for Emailing the image ---
app.post('/api/email', async (req, res) => {
    const { guestPhotoNames, templateName, positions, emailAddress } = req.body;

    if (!guestPhotoNames || !Array.isArray(guestPhotoNames) || guestPhotoNames.length === 0 || !templateName || !emailAddress) {
        return res.status(400).json({ error: 'guestPhotoNames array, templateName, and emailAddress are required.' });
    }

    // Dynamically import nodemailer to prevent crashing if the user hasn't installed it yet
    let nodemailer;
    try {
        nodemailer = (await import('nodemailer')).default;
    } catch (err) {
        console.error('Nodemailer not installed. Please run: npm install nodemailer');
        return res.status(500).json({ error: 'Nodemailer is missing. Please run "npm install nodemailer" in the backend folder.' });
    }

    let config = templateConfigs[templateName] || DEFAULT_TEMPLATE_CONFIG[templateName];
    if (!config) return res.status(404).json({ error: `No configuration found for template: ${templateName}.` });

    let areas = config.areas || (config.x !== undefined ? [{ x: config.x, y: config.y, width: config.width, height: config.height }] : null);
    if (!areas || areas.length === 0) return res.status(400).json({ error: `Template configuration is invalid.` });

    const templatePath = path.join(templatesFolder, templateName);
    const parsedGuestPhoto = path.parse(guestPhotoNames[0]);
    const outputPath = path.join(outputsFolder, `email_${Date.now()}_${parsedGuestPhoto.name}.jpg`);

    try {
        if (!fs.existsSync(templatePath)) return res.status(404).json({ error: 'Template not found.' });

        const templateImage = sharp(templatePath);
        const templateMetadata = await templateImage.metadata();
        const templateStats = await templateImage.stats();
        const isOpaque = templateStats.isOpaque;

        const compositeOperations = [];
        if (isOpaque) compositeOperations.push({ input: templatePath, top: 0, left: 0 });

        const photosToMerge = guestPhotoNames.slice(0, areas.length);

        for (let i = 0; i < photosToMerge.length; i++) {
            const photoName = photosToMerge[i];
            const area = areas[i];
            const position = positions && positions[i] ? positions[i] : { x: 50, y: 50 };
            const guestPhotoPath = path.join(cameraFolder, photoName);

            if (fs.existsSync(guestPhotoPath)) {
                const imgMeta = await sharp(guestPhotoPath).metadata();
                const S = Math.max(area.width / imgMeta.width, area.height / imgMeta.height);
                const scaledW = Math.round(imgMeta.width * S);
                const scaledH = Math.round(imgMeta.height * S);
                
                let extractX = Math.max(0, Math.min(Math.round(((scaledW - area.width) * position.x) / 100), scaledW - Math.round(area.width)));
                let extractY = Math.max(0, Math.min(Math.round(((scaledH - area.height) * position.y) / 100), scaledH - Math.round(area.height)));

                const resizedGuestPhoto = await sharp(guestPhotoPath)
                    .resize({ width: scaledW, height: scaledH })
                    .extract({ left: extractX, top: extractY, width: Math.round(area.width), height: Math.round(area.height) })
                    .toBuffer();
                
                compositeOperations.push({ input: resizedGuestPhoto, top: Math.round(area.y), left: Math.round(area.x) });
            }
        }
        compositeOperations.push({ input: templatePath, top: 0, left: 0 });
        
        if (!isOpaque) compositeOperations.push({ input: templatePath, top: 0, left: 0 });

        const textOverlay = buildTextOverlay(config.texts, templateMetadata.width, templateMetadata.height);
        if (textOverlay) {
            compositeOperations.push({ input: textOverlay, top: 0, left: 0 });
        }

        await sharp({
            create: { width: templateMetadata.width, height: templateMetadata.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
        }).composite(compositeOperations).jpeg().toFile(outputPath);

        const outputBuffer = fs.readFileSync(outputPath);
        const outputUrl = `data:image/jpeg;base64,${outputBuffer.toString('base64')}`;

        // --- ⚠️ UPDATE YOUR EMAIL CREDENTIALS HERE ⚠️ ---
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'gmajgunasekara@gmail.com', // Replace with your Gmail address
                pass: 'szskzcpskeipihmi'     // Replace with your App Password
            }
        });

        const mailOptions = {
            from: '"Photo Booth" <gmajgunasekara@gmail.com>', // Replace with your Gmail address
            to: emailAddress,
            subject: 'Your Photo Booth Picture!',
            text: 'Thank you for using our photo booth! Please find your picture attached.',
            attachments: [{ filename: path.basename(outputPath), path: outputPath }]
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Final image emailed to: ${emailAddress}`);
        res.status(200).json({ success: true, message: `Image emailed and ready to save.`, outputUrl });
    } catch (error) {
        console.error('--- EMAIL PROCESS ERROR ---', error);
        res.status(500).json({ error: 'Email failed to send.', details: error.message, outputUrl });
    }
});

// --- UPDATED: POST endpoint for printing (saves and then prints) ---
app.post('/api/print', async (req, res) => {
    const { guestPhotoNames, templateName, printerName, copies = 1, positions } = req.body;

    if (!guestPhotoNames || !Array.isArray(guestPhotoNames) || guestPhotoNames.length === 0 || !templateName) {
        return res.status(400).json({ error: 'guestPhotoNames array and templateName are required.' });
    }

    // Retrieve the saved configuration for the template, with a fallback to the default
    let config = templateConfigs[templateName];
    if (!config) {
        console.log(`No custom config for ${templateName} during finalization, checking for default.`);
        config = DEFAULT_TEMPLATE_CONFIG[templateName];
    }

    if (!config) {
        return res.status(404).json({ error: `No configuration found for template: ${templateName}.` });
    }

    let areas = config.areas;
    if (!areas && config.x !== undefined) {
        areas = [{ x: config.x, y: config.y, width: config.width, height: config.height }];
    }

    if (!areas || areas.length === 0) {
         return res.status(400).json({ error: `Template configuration is invalid or missing selection areas.` });
    }

    const templatePath = path.join(templatesFolder, templateName);
    const parsedGuestPhoto = path.parse(guestPhotoNames[0]);
    const outputPath = path.join(outputsFolder, `merged_${Date.now()}_${parsedGuestPhoto.name}.jpg`);

    try {
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: 'Template not found for finalization.' });
        }

        const templateImage = sharp(templatePath);
        const templateMetadata = await templateImage.metadata();
        const templateStats = await templateImage.stats();
        const isOpaque = templateStats.isOpaque;
        const templateWidth = templateMetadata.width;
        const templateHeight = templateMetadata.height;
        
        const compositeOperations = [];
        if (isOpaque) compositeOperations.push({ input: templatePath, top: 0, left: 0 });

        const photosToMerge = guestPhotoNames.slice(0, areas.length);

        for (let i = 0; i < photosToMerge.length; i++) {
            const photoName = photosToMerge[i];
            const area = areas[i];
            const position = positions && positions[i] ? positions[i] : { x: 50, y: 50 };
            const guestPhotoPath = path.join(cameraFolder, photoName);

            if (fs.existsSync(guestPhotoPath)) {
                const imgMeta = await sharp(guestPhotoPath).metadata();
                const imgW = imgMeta.width;
                const imgH = imgMeta.height;
                
                const S = Math.max(area.width / imgW, area.height / imgH);
                const scaledW = Math.round(imgW * S);
                const scaledH = Math.round(imgH * S);
                
                let extractX = Math.round(((scaledW - area.width) * position.x) / 100);
                let extractY = Math.round(((scaledH - area.height) * position.y) / 100);
                
                extractX = Math.max(0, Math.min(extractX, scaledW - Math.round(area.width)));
                extractY = Math.max(0, Math.min(extractY, scaledH - Math.round(area.height)));

                const resizedGuestPhoto = await sharp(guestPhotoPath)
                    .resize({ width: scaledW, height: scaledH })
                    .extract({ left: extractX, top: extractY, width: Math.round(area.width), height: Math.round(area.height) })
                    .toBuffer();
                
                compositeOperations.push({ input: resizedGuestPhoto, top: Math.round(area.y), left: Math.round(area.x) });
            }
        }

        compositeOperations.push({ input: templatePath, top: 0, left: 0 });
        if (!isOpaque) compositeOperations.push({ input: templatePath, top: 0, left: 0 });

        const textOverlay = buildTextOverlay(config.texts, templateWidth, templateHeight);
        if (textOverlay) {
            compositeOperations.push({ input: textOverlay, top: 0, left: 0 });
        }

        await sharp({
            create: {
                width: templateWidth,
                height: templateHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
            .composite(compositeOperations)
            .jpeg()
            .toFile(outputPath);

        console.log(`✅ Final image saved to: ${outputPath}`);

        let printCommand = printerName
            ? `Start-Process -FilePath "${outputPath}" -Verb PrintTo -ArgumentList '${printerName}'`
            : `Start-Process -FilePath "${outputPath}" -Verb Print`;

        const fullCommand = `powershell.exe -Command "& {${printCommand}}"`;
        
        const numCopies = parseInt(copies, 10);
        for(let i=0; i<numCopies; i++) {
             exec(fullCommand, (error, stdout, stderr) => {
                 if (error) console.error(`Print command failed (copy ${i+1}): ${error.message}`);
                 if (stderr) console.error(`Print command stderr: ${stderr}`);
                 if (!error) console.log(`🖨️ Print command sent for ${outputPath} (Copy ${i+1} of ${numCopies}).`);
             });
             if (i < numCopies - 1) {
                 await new Promise(resolve => setTimeout(resolve, 1000));
             }
        }

        res.status(200).json({ success: true, message: `Image saved to outputs and ${numCopies} print command(s) sent.` });
    } catch (error) {
        console.error('--- IMAGE FINALIZE ERROR ---', error);
        console.error(error);
        res.status(500).json({ error: 'Image finalization failed.', details: error.message });
    }
});

// Root endpoint for health check
app.get('/', (req, res) => {
    res.send('Wedding Booth Backend is Running!');
});

httpServer.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    // Start watcher on initial load if path is configured
    if (templateConfigs.cameraFolderPath) {
        startWatcher(templateConfigs.cameraFolderPath);
    } else {
        console.log('⚠️ Camera folder path not set. Please configure it via the app in "Template Setup" mode.');
    }
});
