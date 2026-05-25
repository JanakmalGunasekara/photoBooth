// c:\Users\DELL\Documents\oculaa_Photo_Booth\main.cjs
const { app, BrowserWindow, ipcMain, protocol, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const chokidar = require('chokidar');
const sharp = require('sharp');

let mainWindow;
let watcher = null;

// --- Define folder paths in the user's data directory for persistence ---
const appDataPath = app.getPath('userData');
const cameraFolder = path.join(appDataPath, 'camera_folder');
const templatesFolder = path.join(appDataPath, 'templates');
const outputsFolder = path.join(appDataPath, 'outputs');
const configFilePath = path.join(appDataPath, 'config.json');

// --- Core App Functions ---

// Ensure all required directories exist on startup.
const ensureDirs = () => {
    [cameraFolder, templatesFolder, outputsFolder].forEach(folder => {
        if (!fs.existsSync(folder)) {
            console.log(`Creating directory: ${folder}`);
            fs.mkdirSync(folder, { recursive: true });
        }
    });
};

// In-memory store for all application configurations.
let appConfig = {};

const loadConfig = () => {
    try {
        if (fs.existsSync(configFilePath)) {
            appConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
            console.log('Configuration loaded from', configFilePath);
        } else {
            throw new Error('Config file not found, creating a new one.');
        }
    } catch (err) {
        console.warn(err.message);
        appConfig = { templates: {}, cameraFolderPath: null };
        saveConfigToFile();
    }
};

const saveConfigToFile = () => {
    try {
        // Use synchronous write for config to ensure it's saved before proceeding.
        fs.writeFileSync(configFilePath, JSON.stringify(appConfig, null, 2), 'utf8');
        console.log('Configuration saved.');
    } catch (err) {
        console.error('Error writing to config.json:', err);
    }
};

// Watch the designated camera folder for new images.
function startWatcher(folderPath) {
    if (watcher) watcher.close();
    if (!folderPath || !fs.existsSync(folderPath)) {
        console.error(`Watcher not started. Invalid or non-existent path: ${folderPath}`);
        return;
    }

    console.log(`Watching for new photos in: ${folderPath}`);
    watcher = chokidar.watch(folderPath, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }
    }).on('add', (filePath) => {
        const fileName = path.basename(filePath);
        console.log(`📸 New photo detected: ${fileName}`);

        // For consistency and security, copy the photo to the app's internal data directory.
        const destinationPath = path.join(cameraFolder, fileName);
        fs.copyFile(filePath, destinationPath, (err) => {
            if (err) {
                console.error(`Error copying new photo: ${err}`);
                return;
            }
            if (mainWindow) {
                // Send the path of the *copied* file to the renderer.
                mainWindow.webContents.send('NEW_PHOTO', {
                    path: destinationPath,
                    name: fileName
                });
            }
        });
    });
}

// --- IPC Handlers ---

ipcMain.handle('merge-and-print', async (event, { guestPhotoPath, templateName, printerName }) => {
    const templateConfig = appConfig.templates ? appConfig.templates[templateName] : null;
    if (!templateConfig) {
        throw new Error(`Configuration for template "${templateName}" not found.`);
    }

    const { x, y, width, height } = templateConfig;
    const templatePath = path.join(templatesFolder, templateName);
    const outputPath = path.join(outputsFolder, `merged_${Date.now()}_${path.basename(guestPhotoPath)}`);

    try {
        if (!fs.existsSync(templatePath) || !fs.existsSync(guestPhotoPath)) {
            throw new Error('Guest photo or template file not found.');
        }

        const guestPhotoBuffer = await sharp(guestPhotoPath).resize({
            width: Math.round(width),
            height: Math.round(height),
            fit: sharp.fit.cover,
            position: sharp.strategy.attention
        }).toBuffer();

        await sharp(templatePath)
            .composite([{ input: guestPhotoBuffer, top: Math.round(y), left: Math.round(x) }])
            .toFile(outputPath);

        console.log(`✅ Final image saved to: ${outputPath}`);

        // Securely build the PowerShell command to prevent injection.
        const escapedPrinterName = printerName ? printerName.replace(/'/g, "''") : '';
        const printCmd = printerName
            ? `Start-Process -FilePath "${outputPath}" -Verb PrintTo -ArgumentList '${escapedPrinterName}'`
            : `Start-Process -FilePath "${outputPath}" -Verb Print`;
        exec(`powershell.exe -Command "& {${printCmd}}"`, (error, stdout, stderr) => {
            if (error) console.error(`Print command failed: ${error.message}`);
            if (stderr) console.error(`Print command stderr: ${stderr}`);
            if (!error) console.log(`🖨️ Print command sent for ${outputPath}.`);
        });

        return { success: true, message: `Image saved and print command sent.` };
    } catch (error) {
        console.error('--- IMAGE MERGE & PRINT ERROR ---', error);
        throw new Error(`Processing failed: ${error.message}`);
    }
});

ipcMain.handle('get-printers', () => new Promise((resolve, reject) => {
    exec('powershell.exe -Command "Get-Printer | Select-Object -ExpandProperty Name"', (error, stdout, stderr) => {
        if (error) return reject('Failed to fetch printers.');
        if (stderr) console.error(`PowerShell stderr: ${stderr}`);
        resolve(stdout.split(/\r?\n/).filter(p => p.trim() !== ''));
    });
}));

ipcMain.handle('get-templates', () => fs.promises.readdir(templatesFolder).then(files => files.filter(file => /\.(jpe?g|png)$/i.test(file))));

ipcMain.handle('upload-template', (event, { filePath, fileName }) => fs.promises.copyFile(filePath, path.join(templatesFolder, fileName)));

ipcMain.handle('delete-template', async (event, templateName) => {
    // Securely resolve the path to prevent path traversal attacks.
    const fullPath = path.join(templatesFolder, templateName);
    const relative = path.relative(templatesFolder, fullPath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        console.error(`Attempted to delete file outside of templates folder: ${templateName}`);
        return Promise.reject('Invalid template name.');
    }

    await fs.promises.unlink(fullPath);
    if (appConfig.templates && appConfig.templates[templateName]) {
        delete appConfig.templates[templateName];
        saveConfigToFile();
    }
    return `Template '${templateName}' deleted.`;
});

ipcMain.handle('get-config', () => appConfig);

ipcMain.handle('save-config', (event, newConfig) => {
    const oldCameraPath = appConfig.cameraFolderPath;
    appConfig = { ...appConfig, ...newConfig };
    saveConfigToFile();
    if (appConfig.cameraFolderPath && appConfig.cameraFolderPath !== oldCameraPath) {
        startWatcher(appConfig.cameraFolderPath);
    }
    return { success: true };
});

ipcMain.handle('open-folder-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return !canceled && filePaths.length > 0 ? filePaths[0] : null;
});

// --- Electron App Lifecycle ---

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            webSecurity: false // Required for custom file protocol
        }
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
    }
};

app.whenReady().then(() => {
    ensureDirs();
    loadConfig();

    // Use a custom protocol to safely serve files from the app's data directory.
    protocol.registerFileProtocol('local-resource', (request, callback) => {
        const url = request.url.replace('local-resource://', '');
        const decodedPath = path.normalize(decodeURI(url));

        // Security: Only allow access to files within our managed directories.
        const isAllowed = [cameraFolder, templatesFolder, outputsFolder].some(allowedDir => {
            const relative = path.relative(allowedDir, decodedPath);
            return !relative.startsWith('..') && !path.isAbsolute(relative);
        });

        if (isAllowed) {
            callback({ path: decodedPath });
        } else {
            console.error(`Access to path denied: ${decodedPath}`);
            callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    if (appConfig.cameraFolderPath) {
        startWatcher(appConfig.cameraFolderPath);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception in Main Process:', error);
    dialog.showErrorBox('Application Error', 'An unexpected error occurred. The application will now close.');
    app.quit();
});
