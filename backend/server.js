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
    'thank-you-template.png': {
        x: 100,
        y: 290,
        width: 1040,
        height: 1040
    }
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
let latestPhoto = null;

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
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 200
        },
        ignorePermissionErrors: true // Prevents crashes on restricted system folders
    }).on('add', (filePath) => {
        const fileName = path.basename(filePath);
        
        // Ignore non-image files (like temporary files created by camera software)
        if (!/\.(jpe?g|png)$/i.test(fileName)) {
            return;
        }
        
        console.log(`📸 New photo detected: ${fileName}`);

        // Copy the file to the internal 'camera_folder' to be served statically
        const destinationPath = path.join(cameraFolder, fileName);
        
        // Function to retry copying if the file is locked by the camera software
        const copyWithRetry = (src, dest, retries = 5, delay = 500) => {
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
            
                latestPhoto = {
                    name: fileName,
                    path: fileName
                };

                // Emit the event with the URL that points to the internal folder
                io.emit('NEW_PHOTO', {
                    url: `http://localhost:${PORT}/photos/${fileName}`,
                    name: fileName
                });
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
    // The 'templateConfigs' variable is already loaded into memory on startup
    res.status(200).json(templateConfigs);
});

// --- NEW: GET endpoint for latest photo polling ---
app.get('/api/latest-photo', (req, res) => {
    if (latestPhoto) {
        res.status(200).json(latestPhoto);
    } else {
        res.status(200).json({});
    }
});

// --- UPDATED: POST endpoint for PREVIEWING a merged image (in-memory) ---
app.post('/api/merge', async (req, res) => {
    const { guestPhotoName, guestPhotoPath, templateName } = req.body;
    const photoName = guestPhotoName || (guestPhotoPath ? path.basename(guestPhotoPath) : null);

    if (!photoName || !templateName) {
        return res.status(400).json({ error: 'guestPhotoPath and templateName are required.' });
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

    const { x, y, width, height } = config;
    const templatePath = path.join(templatesFolder, templateName);
    const resolvedGuestPhotoPath = path.join(cameraFolder, photoName);

    try {
        if (!fs.existsSync(templatePath) || !fs.existsSync(resolvedGuestPhotoPath)) {
            return res.status(404).json({ error: 'Guest photo or template not found for preview.' });
        }

        console.log(`Generating merge preview for ${photoName}...`);

        const templateMetadata = await sharp(templatePath).metadata();

        // Smartly crop and resize the guest photo to fit the defined area
        const guestPhotoBuffer = await sharp(resolvedGuestPhotoPath)
            .resize({
                width: Math.round(width), // Use saved config width
                height: Math.round(height), // Use saved config height
                fit: sharp.fit.cover, // Cover the area, cropping if necessary
                position: sharp.strategy.attention // Focus on the most interesting part
            })
            .toBuffer();

        // Composite: White Background -> Guest Photo -> Template Overlay
        const outputBuffer = await sharp({
            create: {
                width: templateMetadata.width,
                height: templateMetadata.height,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
            .composite([
                { input: guestPhotoBuffer, top: Math.round(y), left: Math.round(x) },
                { input: templatePath, top: 0, left: 0 }
            ])
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

// --- UPDATED: POST endpoint for printing (saves and then prints) ---
app.post('/api/print', async (req, res) => {
    const { guestPhotoName, templateName, printerName } = req.body;

    if (!guestPhotoName || !templateName) {
        return res.status(400).json({ error: 'guestPhotoName and templateName are required.' });
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

    const { x, y, width, height } = config;
    const templatePath = path.join(templatesFolder, templateName);
    const guestPhotoPath = path.join(cameraFolder, guestPhotoName);
    const parsedGuestPhoto = path.parse(guestPhotoName);
    const outputPath = path.join(outputsFolder, `merged_${Date.now()}_${parsedGuestPhoto.name}.jpg`);

    try {
        if (!fs.existsSync(templatePath) || !fs.existsSync(guestPhotoPath)) {
            return res.status(404).json({ error: 'Guest photo or template not found for finalization.' });
        }

        // This logic is duplicated from the preview endpoint to ensure consistency
        const templateMetadata = await sharp(templatePath).metadata();
        const templateWidth = templateMetadata.width;
        const templateHeight = templateMetadata.height;
        const resizeWidth = Math.round(Math.min(Number(width), templateWidth));
        const resizeHeight = Math.round(Math.min(Number(height), templateHeight));

        const resizedGuestPhoto = await sharp(guestPhotoPath)
            .resize({ width: resizeWidth, height: resizeHeight, fit: sharp.fit.cover, position: sharp.strategy.attention })
            .toBuffer();

        // Composite: White Background -> Guest Photo -> Template Overlay
        await sharp({
            create: {
                width: templateWidth,
                height: templateHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
            .composite([
                { input: resizedGuestPhoto, top: Math.round(y), left: Math.round(x) },
                { input: templatePath, top: 0, left: 0 }
            ])
            .jpeg()
            .toFile(outputPath);

        console.log(`✅ Final image saved to: ${outputPath}`);

        let printCommand = printerName
            ? `Start-Process -FilePath "${outputPath}" -Verb PrintTo -ArgumentList '${printerName}'`
            : `Start-Process -FilePath "${outputPath}" -Verb Print`;

        const fullCommand = `powershell.exe -Command "& {${printCommand}}"`;
        exec(fullCommand, (error, stdout, stderr) => {
            if (error) console.error(`Print command failed: ${error.message}`);
            if (stderr) console.error(`Print command stderr: ${stderr}`);
            if (!error) console.log(`🖨️ Print command sent for ${outputPath}.`);
        });

        res.status(200).json({ success: true, message: `Image saved to outputs and print command sent.` });
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
