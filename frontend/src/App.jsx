import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const BACKEND_URL = 'http://localhost:5000'; // Define your backend URL

function App() {
  // Global state
  const [mode, setMode] = useState('live'); // 'live' or 'setup'
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Live Booth Mode State
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false); // To show the interactive editor
  const [photoPositions, setPhotoPositions] = useState([]); // Array of {x: 50, y: 50}
  const [templateScale, setTemplateScale] = useState(1);
  const previewContainerRef = useRef(null);
  const [highlightedPhoto, setHighlightedPhoto] = useState(null); // To view a single photo clearly
  const [liveTemplateBoxes, setLiveTemplateBoxes] = useState([]); // To preview layout in live mode
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printCopies, setPrintCopies] = useState(1);
  const [emailAddress, setEmailAddress] = useState('');
  const [templates, setTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState('');
  const [cameraFolderPath, setCameraFolderPath] = useState('');
  const [appConfig, setAppConfig] = useState({});

  // Web-based Folder Browser State
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [subDirs, setSubDirs] = useState([]);

  // Template Setup Mode State
  const [selectedTemplateForEditing, setSelectedTemplateForEditing] = useState(null);
  const [selectionBoxes, setSelectionBoxes] = useState([]);
  const [currentBox, setCurrentBox] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const templateImageRef = useRef(null);
  const lastPhotoNameRef = useRef(null);
  const lastUpdateRef = useRef(null); // Ref to track overall session updates
  const dragRef = useRef({ isDragging: false, index: -1, startX: 0, startY: 0, startPos: {x:50, y:50} });

  // --- Theme Effect ---
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // --- Main Effect Hook ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch Printers
        const printerRes = await fetch(`${BACKEND_URL}/api/printers`);
        if (printerRes.ok) {
          const printerList = await printerRes.json();
          setPrinters(printerList);
          if (printerList.length > 0) {
            setSelectedPrinter(printerList[0]);
          }
        }

        // Fetch Templates
        const templateRes = await fetch(`${BACKEND_URL}/api/templates`);
        if (templateRes.ok) {
          const templateList = await templateRes.json();
          setTemplates(templateList);
          if (templateList.length > 0) {
            setActiveTemplate(templateList[0]);
          }
        }

        // Fetch App Configuration (including camera folder path)
        const configRes = await fetch(`${BACKEND_URL}/api/config`);
        if (configRes.ok) {
          const config = await configRes.json();
          setAppConfig(config);
          setCameraFolderPath(config.cameraFolderPath || '');
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }
    };

    fetchInitialData();

    const getAssetUrl = (type, name) => {
      return `${BACKEND_URL}/${type}s/${name}`;
    };

    // Poll for new photos
    const pollNewPhoto = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/latest-photo?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.lastUpdate !== lastUpdateRef.current) {
             lastUpdateRef.current = data.lastUpdate;
             setRecentPhotos(data.recent || []);
             
             if (data.recent && data.recent.length > 0) {
                 const topName = data.recent[0].name;
                 if (topName !== lastPhotoNameRef.current || data.recent[0].timestamp) {
                     // Triggers highlight if it's a new name OR an overwritten file
                     lastPhotoNameRef.current = topName;
                     setHighlightedPhoto(topName);
                 }
             }
          }
        }
      } catch (error) {
        // Ignore polling errors
      }
    };

    const intervalId = setInterval(pollNewPhoto, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [mode]); // Re-run effect if mode changes to fetch config

  // --- Global Drag & Resize Handlers for Interactive Preview ---
  useEffect(() => {
    const handleMouseMove = (e) => {
        if (!dragRef.current.isDragging) return;
        if (e.cancelable) e.preventDefault(); // Prevent page scroll while dragging
        const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - dragRef.current.startX;
        const deltaY = clientY - dragRef.current.startY;
        const sensitivity = 0.5; // Drag speed
        
        setPhotoPositions(prev => {
            const newPos = [...prev];
            const startPos = dragRef.current.startPos;
            newPos[dragRef.current.index] = {
                x: Math.max(0, Math.min(100, startPos.x - deltaX * sensitivity)),
                y: Math.max(0, Math.min(100, startPos.y - deltaY * sensitivity))
            };
            return newPos;
        });
    };

    const handleMouseUp = () => {
        dragRef.current.isDragging = false;
    };

    if (mode === 'live') {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleMouseMove, { passive: false });
        window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleMouseMove);
        window.removeEventListener('touchend', handleMouseUp);
    };
  }, [mode]);

  // Helper to get the correct asset URL based on environment
  const getAssetUrl = (type, item) => {
    if (item && typeof item === 'object') {
      return `${BACKEND_URL}/${type}s/${item.name}?t=${item.timestamp || ''}`;
    }
    return `${BACKEND_URL}/${type}s/${item}`;
  };

  // Number of areas for active template
  const activeTemplateConfig = appConfig[activeTemplate] || {};
  const requiredPhotos = activeTemplateConfig.areas ? activeTemplateConfig.areas.length : (activeTemplateConfig.x ? 1 : 1);

  const togglePhotoSelection = (photoName) => {
     if (selectedPhotos.includes(photoName)) {
        setSelectedPhotos(selectedPhotos.filter(p => p !== photoName));
     } else {
        if (selectedPhotos.length < requiredPhotos) {
           setSelectedPhotos([...selectedPhotos, photoName]);
        } else {
           console.warn(`This template requires exactly ${requiredPhotos} photo(s).`);
        }
     }
  };

  // --- Live Booth Mode Handlers ---
  const handleApproveAndPreview = () => {
    if (selectedPhotos.length !== requiredPhotos || isProcessing) return;
    setIsPreviewMode(true);
  };

  const handleBackToSelection = () => {
    if (isProcessing) return;
    setIsPreviewMode(false); // Go back to selection mode without clearing photos
  };

  const handleReject = async () => {
    if (isProcessing) return;
    await resetSession();
  };

  const handleDeletePhoto = async (photoName, e) => {
    if (e) e.stopPropagation();
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/photos/${encodeURIComponent(photoName)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete photo');
      
      setRecentPhotos(prev => prev.filter(p => p.name !== photoName));
      setSelectedPhotos(prev => prev.filter(p => p !== photoName));
      if (highlightedPhoto === photoName) setHighlightedPhoto(null);
      if (lastPhotoNameRef.current === photoName) lastPhotoNameRef.current = null;
    } catch (error) {
      console.error("Error deleting photo:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSession = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/clear-session`, { method: 'POST' });
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
    setRecentPhotos([]);
    setSelectedPhotos([]);
    setHighlightedPhoto(null);
    setIsPreviewMode(false);
    setPhotoPositions([]);
    setEmailAddress('');
    lastPhotoNameRef.current = null;
    lastUpdateRef.current = null;
  };

  const handlePrint = async () => {
    if (!isPreviewMode || isProcessing) return;
    
    const copies = printCopies;
    setIsProcessing(true);

    const printConfig = {
      guestPhotoNames: selectedPhotos,
      templateName: activeTemplate,
      printerName: selectedPrinter,
      copies: copies,
      positions: photoPositions
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printConfig),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to print image');
      }

      await resetSession(); // Reset the view and clear photos
      console.log(`Print command sent for ${copies} copy(ies)! Ready for new images.`);
    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred.';
      console.error(`Failed to print image: ${errorMessage}`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmail = async () => {
    if (!isPreviewMode || isProcessing || !emailAddress) return;
    
    setIsProcessing(true);

    const payload = {
      guestPhotoNames: selectedPhotos,
      templateName: activeTemplate,
      positions: photoPositions,
      emailAddress: emailAddress
    };

    let responseData = null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      responseData = await res.json();

      // Trigger download to prompt user for save location
      if (responseData.outputUrl) {
        const link = document.createElement('a');
        link.href = responseData.outputUrl;
        link.download = `photobooth-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to send email');
      }

      await resetSession();
      console.log(`Email sent to ${emailAddress} and saved! Ready for new images.`);
    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred.';
      console.error(`Notice: ${errorMessage}`);
      if (responseData && responseData.outputUrl) {
        await resetSession(); // Reset if user was at least prompted to save
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!isPreviewMode) return;

    setIsProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestPhotoNames: selectedPhotos,
          templateName: activeTemplate,
          positions: photoPositions
        }),
      });

      if (!res.ok) throw new Error('Failed to merge image');
      const data = await res.json();

      const link = document.createElement('a');
      link.href = data.outputUrl;
      link.download = `photobooth-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await resetSession();
      console.log('Image saved! Ready for new images.');
    } catch (error) {
      console.error('Failed to save image.');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Template Setup Mode Handlers ---
  const getCoords = (e) => {
    const rect = templateImageRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  };

  const handleMouseDown = (e) => {
    if (mode !== 'setup') return;
    if (selectionBoxes.length >= 4) {
      console.warn("Maximum of 4 selection areas allowed.");
      return;
    }
    setIsDrawing(true);
    const point = getCoords(e);
    setStartPoint(point);
    setCurrentBox({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || mode !== 'setup') return;
    const currentPoint = getCoords(e);
    const newBox = {
      x: Math.min(startPoint.x, currentPoint.x),
      y: Math.min(startPoint.y, currentPoint.y),
      width: Math.abs(currentPoint.x - startPoint.x),
      height: Math.abs(currentPoint.y - startPoint.y),
    };
    setCurrentBox(newBox);
  };

  const handleMouseUp = () => {
    if (mode !== 'setup' || !isDrawing) return;
    setIsDrawing(false);
    if (currentBox && currentBox.width > 10 && currentBox.height > 10) {
      setSelectionBoxes([...selectionBoxes, currentBox]);
    }
    setCurrentBox(null);
  };

  const handleClearBoxes = () => {
    setSelectionBoxes([]);
  };

  const handleSelectTemplateForEditing = (template) => {
    setSelectedTemplateForEditing(template);
    setSelectionBoxes([]);
  };

  const handleTemplateImageLoad = (e) => {
    const img = e.target;
    const config = appConfig[selectedTemplateForEditing];
    
    if (config) {
      let areas = config.areas;
      if (!areas && config.x !== undefined) {
        areas = [{ x: config.x, y: config.y, width: config.width, height: config.height }];
      }
      
      if (areas && areas.length > 0) {
        const scaleX = img.clientWidth / img.naturalWidth;
        const scaleY = img.clientHeight / img.naturalHeight;
        const loadedBoxes = areas.map(area => ({
          x: area.x * scaleX,
          y: area.y * scaleY,
          width: area.width * scaleX,
          height: area.height * scaleY,
        }));
        setSelectionBoxes(loadedBoxes);
      }
    }
  };

  const handleSaveConfig = async () => {
    if (selectionBoxes.length === 0) {
      console.warn("Please draw at least one selection box on the template.");
      return;
    }
    const img = templateImageRef.current;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const realCoordsArray = selectionBoxes.map(box => ({
      x: box.x * scaleX,
      y: box.y * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY,
    }));

    try {
      const newConfig = { ...appConfig };
      newConfig[selectedTemplateForEditing] = { areas: realCoordsArray };

      const res = await fetch(`${BACKEND_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });

      if (!res.ok) {
        throw new Error('Failed to save configuration');
      }

      setAppConfig(newConfig);

      setSelectedTemplateForEditing(null); // Go back to the template list
      setSelectionBoxes([]); // Reset selection
      console.log(`Configuration saved for ${selectedTemplateForEditing}!`);
    } catch (error) {
      console.error("Failed to save configuration. Check the console.", error);
    }
  };

  const handleDeleteTemplate = async (templateName) => {
    if (isProcessing) return;

    if (!window.confirm(`Are you sure you want to delete the template "${templateName}"? This cannot be undone.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/templates/${templateName}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete template');
      }

      // Refresh the template list after deletion
      const templateRes = await fetch(`${BACKEND_URL}/api/templates`);
      if (templateRes.ok) {
        const templateList = await templateRes.json();
        setTemplates(templateList);
        
        // If the deleted template was the active one, reset to the first available
        if (activeTemplate === templateName) {
          setActiveTemplate(templateList.length > 0 ? templateList[0] : '');
        }
      }
    } catch (error) {
      console.error('Failed to delete template. See console for details.', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhotoDragStart = (e, index) => {
      // Prevent standard browser dragging on images
      if (e.cancelable && e.type !== 'touchstart') e.preventDefault(); 
      dragRef.current = {
          isDragging: true,
          index,
          startX: e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX,
          startY: e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY,
          startPos: photoPositions[index] || {x: 50, y: 50}
      };
  };

  const handleTemplateUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('template', file); // This key must match the backend's 'upload.single('template')'

    setIsProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/templates/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Failed to upload template');
      }

      // Refresh the template list to show the new one
      const templateRes = await fetch(`${BACKEND_URL}/api/templates`);
      if (templateRes.ok) {
        const templateList = await templateRes.json();
        setTemplates(templateList);
      }
      console.log(`Template '${file.name}' uploaded successfully!`);
    } catch (error) {
      console.error('Failed to upload template. See console for details.', error);
    } finally {
      setIsProcessing(false);
      event.target.value = null; // Clear the input so the same file can be uploaded again if needed
    }
  };

  const handleBrowseFolder = async () => {
    // This function relies on an API exposed by Electron's preload script
    if (window.electronAPI && typeof window.electronAPI.openFolderDialog === 'function') {
      try {
        const selectedPath = await window.electronAPI.openFolderDialog();
        if (selectedPath) {
          setCameraFolderPath(selectedPath);
        }
      } catch (error) {
        console.error("Error opening folder dialog:", error);
      }
    } else {
      // Fallback: Open web-based folder browser
      setShowFolderModal(true);
      fetchDirectories(cameraFolderPath);
    }
  };

  const fetchDirectories = async (dir = '') => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/directories?dir=${encodeURIComponent(dir)}`);
      if (res.ok) {
        const data = await res.json();
        setBrowsePath(data.currentDir);
        setSubDirs(data.directories);
      }
    } catch (e) {
      console.error("Failed to fetch directories", e);
    }
  };

  const handleSetCameraFolder = async () => {
    if (!cameraFolderPath.trim()) {
      console.warn("Please enter a valid folder path.");
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/camera-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: cameraFolderPath }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to set camera folder');
      }

      const data = await res.json();
      console.log(data.message || 'Camera folder set successfully');
    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred.';
      console.error(`Failed to set camera folder: ${errorMessage}`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Dynamic Layout Calculation for Live Template Preview ---
  useEffect(() => {
    const updateBoxes = () => {
      const img = document.getElementById('live-preview-img');
      if (!img) return;
      const config = appConfig[activeTemplate];
      if (config) {
        let areas = config.areas || (config.x !== undefined ? [config] : []);
        const { naturalWidth, naturalHeight } = img;
        if (!naturalWidth || !naturalHeight) return;
        setLiveTemplateBoxes(areas.map(area => ({
           left: `${(area.x / naturalWidth) * 100}%`,
           top: `${(area.y / naturalHeight) * 100}%`,
           width: `${(area.width / naturalWidth) * 100}%`,
           height: `${(area.height / naturalHeight) * 100}%`
        })));
      } else {
        setLiveTemplateBoxes([]);
      }
    };

    updateBoxes();
    const handleLoad = () => updateBoxes();
    window.addEventListener('template-loaded', handleLoad);
    return () => window.removeEventListener('template-loaded', handleLoad);
  }, [activeTemplate, appConfig]);

  // --- Main Render ---
  return (
    <div className="dashboard">
      <style>{`
        /* --- Full Window Layout Styles --- */
        html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        .dashboard { display: flex; flex-direction: column; width: 100vw; height: 100vh; max-width: 1440px; margin: 0 auto; overflow: hidden; box-sizing: border-box; }
        .header { flex-shrink: 0; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); }
        .header h1 { margin: 0; font-size: 1.5rem; }
        .header-actions { display: flex; gap: 15px; align-items: center; }
        .main-content { flex: 1; display: flex; flex-direction: row; gap: 20px; padding: 10px 20px 20px 20px; height: 100%; box-sizing: border-box; overflow: hidden; }
        .main-content.setup-layout { flex-direction: column; overflow-y: auto; padding: 10px 20px; align-items: center; justify-content: flex-start; }
        .preview-container { flex: 6.5; display: flex; flex-direction: column; background: var(--item-bg); border-radius: 12px; padding: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
        .controls-container { flex: 3.5; display: flex; flex-direction: column; background: var(--item-bg); border-radius: 12px; padding: 8px 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.2); position: relative; }
        .controls-container .actions { flex-shrink: 0; margin-top: auto; padding-top: 10px; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; } 

        .live-selection-wrapper { display: flex; flex-direction: row; width: 100%; height: 100%; gap: 20px; min-height: 0; overflow: hidden; }
        .recent-photos-column { flex: 0 0 120px; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; gap: 15px; padding: 5px; }
        .recent-photos-column::-webkit-scrollbar { width: 6px; }
        .recent-photos-column::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        .photo-thumbnail { flex: 0 0 auto; position: relative; cursor: pointer; width: 100%; padding: 4px; box-sizing: border-box; background: transparent; border-radius: 8px; opacity: 0.6; transition: all 0.3s ease; }
        .photo-thumbnail:hover { opacity: 1; transform: translateY(-3px); }
        .photo-thumbnail.active-highlight { opacity: 1; background: rgba(255, 154, 158, 0.2); box-shadow: inset 0 0 0 2px #ff9a9e; }
        .photo-thumbnail.selected { opacity: 1; background: rgba(40, 167, 69, 0.2); box-shadow: inset 0 0 0 2px #28a745; }
        .photo-thumbnail img { width: 100%; height: auto; object-fit: contain; display: block; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
        .photo-thumbnail .badge { position: absolute; top: 5px; right: 5px; background: #28a745; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.4); z-index: 2; }

        .no-photo { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: var(--text-muted); font-size: 1.2rem; border: 2px dashed var(--border-color); border-radius: 12px; }

        /* Template Editor in Setup Mode */
        .setup-container.list-mode { width: 100%; max-width: 1200px; height: 98%; display: flex; flex-direction: column; gap: 15px; }
        .setup-container.editing-mode { overflow: visible; gap: 15px; padding: 10px; width: 100%; max-width: 900px; height: auto; }
        .setup-container.editing-mode h2 { margin: 0; font-size: 1.4rem; }
        .setup-container.editing-mode p { margin: 0 0 5px 0; font-size: 0.9rem; color: var(--text-muted); }
        .config-section {
          display: flex;
          flex-direction: column;
          background: var(--item-bg);
          border-radius: 12px;
          padding: 15px 20px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        .config-section h2 {
          margin-top: 0;
          padding-bottom: 5px;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 10px;
          text-align: left;
          font-size: 1.2rem;
        }
        
        /* New Vertical Stack Layout */
        .config-section.system-config-card { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        .config-section.template-management-card { flex: 3; display: flex; flex-direction: column; overflow: hidden; }
        
        .system-config-card .control-group { flex-direction: row; align-items: center; gap: 15px; }
        .system-config-card .control-group label { margin-bottom: 0; flex-shrink: 0; font-size: 0.9rem; }
        .system-config-card .input-group { margin-top: 0; flex-grow: 1; }
        
        .template-management-card .template-gallery { flex: 1; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 15px; overflow-y: auto; padding: 5px 5px 5px 0; }
        .template-management-card .template-item { width: 120px; flex-shrink: 0; }
        .template-management-card .upload-container {
          margin-top: auto;
          padding-top: 15px;
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
        }
        .template-management-card .upload-container h3 { font-size: 1rem; margin: 0; }

        .template-editor {
          position: relative;
          display: block; /* Use block to allow scrolling */
          text-align: center;
          padding: 20px;
          /* margin: 20px auto; Removed, relying on parent gap */
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden; 
          background: var(--item-bg);
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .template-editor img {
          max-width: 100%; 
          height: auto; 
          object-fit: contain; /* Scale down to fit without cropping */
          display: block;
          margin: 0 auto;
        }

        .selection-box { position: absolute; border: 2px dashed #ff0000; background: rgba(255, 0, 0, 0.2); pointer-events: none; }
        .selection-box .box-index { position: absolute; top: 0; left: 0; background: red; color: white; padding: 2px 6px; font-size: 14px; font-weight: bold; }
        .highlighted-photo-container { background: transparent; border: none; padding: 0; display: flex; justify-content: center; align-items: center; flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
        .highlighted-photo-wrapper { position: relative; display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; min-height: 0; overflow: hidden; }
        .highlighted-img-container { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden; position: relative; }
        .highlighted-img { max-height: 100%; max-width: 100%; width: auto; height: auto; border-radius: 8px; object-fit: contain; box-shadow: 0 8px 25px rgba(0,0,0,0.4); }
        .large-badge { position: absolute; top: 15px; right: 15px; background: #28a745; color: white; border-radius: 50%; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 2; }
        .highlighted-actions { position: absolute; bottom: 20px; right: 20px; display: flex; flex-direction: row; gap: 15px; z-index: 10; }
        .highlighted-actions button { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; padding: 0; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .highlighted-actions button:hover:not(:disabled) { transform: scale(1.1); box-shadow: 0 6px 12px rgba(0,0,0,0.4); }
        .delete-photo-btn { position: absolute; top: -5px; left: -5px; background: rgba(220, 53, 69, 0.9); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 14px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 5; padding: 0; line-height: 1; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .delete-photo-btn:hover { background: #dc3545; transform: scale(1.15) rotate(90deg); }
        .back-arrow-btn { position: absolute; top: 20px; left: 20px; background: var(--input-bg); border: 1px solid var(--border-color); width: 36px; height: 36px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; color: var(--accent-pink); cursor: pointer; padding: 0; transition: all 0.3s; z-index: 100; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
        .back-arrow-btn:hover { background: var(--accent-pink); color: #121212; transform: translateX(-5px); box-shadow: 0 6px 12px rgba(255, 154, 158, 0.3); }
        .preview-container h2 { margin-top: 0; margin-bottom: 10px; font-size: 1.4rem; }
      `}</style>
        
        {/* --- NEW: Live Template Preview Styles --- */}
        <style>{`
          .live-template-preview {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            margin-top: 5px;
          }
          .live-template-preview-wrapper { flex: 1; min-height: 0; position: relative; display: flex; align-items: center; justify-content: center; }
          .live-template-preview-img { display: block; object-fit: contain; max-width: 100%; max-height: 100%; border: 1px solid var(--border-color); border-radius: 4px; }
          .live-template-box { position: absolute; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem; text-shadow: 1px 1px 2px black; box-sizing: border-box; z-index: 5; }

          .controls-container h2, .controls-container .control-group { flex-shrink: 0; }
          .theme-toggle, .help-icon, .settings-icon {
            position: static !important;
            cursor: pointer;
            font-size: 1.2rem;
            width: 35px;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.3s;
            user-select: none;
          }
          .theme-toggle:hover, .help-icon:hover, .settings-icon:hover { background-color: var(--border-color); }
        `}</style>

      <header className="header">
        <h1>Photo Booth Dashboard</h1>
        <div className="header-actions">
          <div className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)} title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            {isDarkMode ? '☀️' : '🌙'}
          </div>
          <div className="help-icon" onClick={() => setShowInstructions(true)} title="Show Instructions">
            ❓
          </div>
          <div className="settings-icon" onClick={() => setMode(prev => prev === 'live' ? 'setup' : 'live')} title={mode === 'live' ? 'Go to Settings' : 'Back to Live Booth'}>
            {mode === 'live' ? '⚙️' : '🖥️'}
          </div>
        </div>
      </header>

      {mode === 'live' ? (
        isPreviewMode ? (
          // --- Final Preview and Action Step ---
          <main className="main-content">
            <div className="preview-container" ref={previewContainerRef}>
              <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>Final Preview (Drag photos to adjust)</h2>
              <div className="photo-review-wrapper" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', minHeight: 0, padding: '10px' }}>
                <div className="photo-review" style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '100%', borderRadius: '8px' }}>
                <img 
                  src={getAssetUrl('template', activeTemplate)} 
                  alt="Final merged card"
                  className="template-bg"
                  style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 220px)', width: 'auto', height: 'auto', display: 'block', position: 'relative', zIndex: 10, pointerEvents: 'none' }}
                  onLoad={(e) => {
                     const img = e.target;
                     setTemplateScale(img.clientWidth / img.naturalWidth);
                  }}
                />
                {(() => {
                   let areas = activeTemplateConfig.areas;
                   if (!areas && activeTemplateConfig.x !== undefined) {
                     areas = [{ x: activeTemplateConfig.x, y: activeTemplateConfig.y, width: activeTemplateConfig.width, height: activeTemplateConfig.height }];
                   }
                   return areas && areas.slice(0, selectedPhotos.length).map((area, idx) => {
                     const pos = photoPositions[idx] || {x: 50, y: 50};
                     return (
                       <div 
                         key={idx}
                         style={{
                           position: 'absolute',
                           left: area.x * templateScale,
                           top: area.y * templateScale,
                           width: area.width * templateScale,
                           height: area.height * templateScale,
                           overflow: 'hidden',
                           zIndex: 1,
                           cursor: 'grab',
                           boxShadow: '0 0 0 2px rgba(255,255,255,0.5)'
                         }}
                         onMouseDown={(e) => handlePhotoDragStart(e, idx)}
                         onTouchStart={(e) => handlePhotoDragStart(e, idx)}
                       >
                          <img 
                            src={getAssetUrl('photo', recentPhotos.find(p => p.name === selectedPhotos[idx]) || selectedPhotos[idx])} 
                            style={{
                              width: '100%', height: '100%', 
                              objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`,
                              pointerEvents: 'none', display: 'block'
                            }} 
                            alt="Guest"
                          />
                       </div>
                     );
                   });
                })()}
                </div>
              </div>
            </div>
            <div className="controls-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '25px 20px' }}>
              <button onClick={handleBackToSelection} disabled={isProcessing} className="back-arrow-btn" title="Back to Selection">⬅</button>
              <h2 style={{ textAlign: 'center', marginBottom: '5px' }}>Finalize</h2>
              
              <div className="control-group" style={{ alignItems: 'stretch', marginBottom: '5px' }}>
                <label htmlFor="printer-select" style={{ fontSize: '0.95rem', marginBottom: '0' }}>Select Printer:</label>
                <select id="printer-select" value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} disabled={printers.length === 0 || isProcessing} style={{ padding: '0.4em 0.8em' }}>
                  {printers.length > 0 ? printers.map(p => <option key={p} value={p}>{p}</option>) : <option>No printers found</option>}
                </select>
              </div>
              
              <div className="control-group" style={{ flexDirection: 'row', gap: '15px', alignItems: 'center', marginTop: '5px', marginBottom: '5px' }}>
                <label htmlFor="print-copies" style={{ fontSize: '0.95rem', whiteSpace: 'nowrap' }}>Copies:</label>
                <input
                  id="print-copies"
                  type="number"
                  min="1"
                  max="50"
                  value={printCopies}
                  onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={isProcessing}
                  style={{ width: '60px', padding: '0.4em', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--input-bg)', color: 'var(--text-main)', textAlign: 'center', fontSize: '0.95rem' }}
                />
                <button onClick={handlePrint} disabled={isProcessing} className="approve-btn" style={{ flex: 1, padding: '0.5em', fontSize: '0.95rem' }}>
                  {isProcessing ? 'Printing...' : '🖨️ Print Now'}
                </button>
              </div>

              <div className="control-group" style={{ flexDirection: 'row', gap: '15px', alignItems: 'center', marginTop: '5px', marginBottom: '5px' }}>
                <label htmlFor="email-input" style={{ fontSize: '0.95rem', whiteSpace: 'nowrap' }}>Email:</label>
                <input
                  id="email-input"
                  type="email"
                  placeholder="guest@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  disabled={isProcessing}
                  style={{ flex: 1, padding: '0.4em', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.95rem', minWidth: 0 }}
                />
                <button onClick={handleEmail} disabled={isProcessing || !emailAddress} className="approve-btn" style={{ padding: '0.5em 1em', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                  {isProcessing ? 'Sending...' : '✉️ Send Email'}
                </button>
              </div>

              <div className="actions" style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'nowrap' }}>
                <button onClick={handleDownload} disabled={isProcessing} className="download-btn" style={{ padding: '0.6em 1.2em', fontSize: '1rem', flex: 1 }}>
                  💾 Save as JPG...
                </button>
                <button onClick={handleReject} disabled={isProcessing} className="reject-btn" style={{ padding: '0.6em 1.2em', fontSize: '1rem', flex: 1 }}>
                  ❌ Reject
                </button>
              </div>
            </div>
          </main>
        ) : (
          // --- Initial Photo Approval Step ---
          <main className="main-content">
            <div className="preview-container">
              <div className="live-selection-wrapper">
                <div className="recent-photos-column">
                  {recentPhotos.map(photo => {
                    const index = selectedPhotos.indexOf(photo.name);
                    const isSelected = index !== -1;
                    return (
                        <div
                            key={photo.name}
                            className={`photo-thumbnail ${isSelected ? 'selected' : ''} ${highlightedPhoto === photo.name ? 'active-highlight' : ''}`}
                            onClick={() => setHighlightedPhoto(photo.name)}
                        >
                            <img src={getAssetUrl('photo', photo)} alt={photo.name} />
                            {isSelected && <div className="badge">{index + 1}</div>}
                            <button
                                className="delete-photo-btn"
                                onClick={(e) => handleDeletePhoto(photo.name, e)}
                                title="Delete Photo"
                            >&times;</button>
                        </div>
                    );
                  })}
                  {recentPhotos.length === 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>No photos yet</div>
                  )}
                </div>
                <div className="highlighted-photo-container">
                  {highlightedPhoto ? (
                      <div className="highlighted-photo-wrapper">
                          <div className="highlighted-img-container">
                              <img src={getAssetUrl('photo', recentPhotos.find(p => p.name === highlightedPhoto) || highlightedPhoto)} alt="Highlighted" className="highlighted-img" />
                              {selectedPhotos.includes(highlightedPhoto) && (
                                  <div className="large-badge">{selectedPhotos.indexOf(highlightedPhoto) + 1}</div>
                              )}
                          </div>
                          <div className="highlighted-actions">
                              <button
                                  className={selectedPhotos.includes(highlightedPhoto) ? 'reject-btn' : 'approve-btn'}
                                  onClick={() => togglePhotoSelection(highlightedPhoto)}
                                  disabled={!selectedPhotos.includes(highlightedPhoto) && selectedPhotos.length >= requiredPhotos}
                                  title={selectedPhotos.includes(highlightedPhoto) ? 'Deselect Photo' : 'Select Photo'}
                              >
                                  {selectedPhotos.includes(highlightedPhoto) ? '❌' : '✅'}
                              </button>
                              <button
                                  className="reject-btn"
                                  onClick={(e) => handleDeletePhoto(highlightedPhoto, e)}
                                  disabled={isProcessing}
                                  title="Delete Photo"
                              >
                                  🗑️
                              </button>
                          </div>
                      </div>
                  ) : (
                      <div className="no-photo" style={{ border: 'none' }}><p>Waiting for new photos...</p></div>
                  )}
                </div>
              </div>
            </div>
        
        {/* --- Controls Section --- */}
            <div className="controls-container" style={{ justifyContent: 'space-between' }}>
              <div className="control-group" style={{ marginBottom: '0' }}>
                <label htmlFor="template-select" style={{ alignSelf: 'flex-start', marginBottom: '2px' }}>Active Template:</label>
                <select id="template-select" value={activeTemplate} onChange={(e) => { setActiveTemplate(e.target.value); setSelectedPhotos([]); setLiveTemplateBoxes([]); }} disabled={templates.length === 0 || isProcessing}>
                  {templates.length > 0 ? templates.map(t => <option key={t} value={t}>{t}</option>) : <option>No templates found</option>}
                </select>
              </div>

              {activeTemplate && (
                <div className="live-template-preview" style={{ marginTop: '-5px' }}>
                  <div className="live-template-preview-wrapper">
                    <div style={{ position: 'relative', display: 'inline-block', height: '100%', maxWidth: '100%' }}>
                      <img 
                        id="live-preview-img"
                        src={getAssetUrl('template', activeTemplate)} 
                        alt="Layout Preview"
                        className="live-template-preview-img"
                        style={{ display: 'block', height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
                        onLoad={() => window.dispatchEvent(new Event('template-loaded'))}
                      />
                      {liveTemplateBoxes.map((box, idx) => {
                        const hasPhoto = selectedPhotos[idx];
                        const pos = photoPositions[idx] || {x: 50, y: 50};
                        return (
                          <div key={idx} className="live-template-box" 
                            style={{ 
                              left: box.left, top: box.top, width: box.width, height: box.height,
                              background: hasPhoto ? 'transparent' : 'rgba(76, 175, 80, 0.4)',
                              border: hasPhoto ? '2px solid rgba(255, 255, 255, 0.8)' : '2px solid #4CAF50',
                              overflow: 'hidden',
                              cursor: hasPhoto ? 'grab' : 'default',
                              padding: 0
                            }}
                            onMouseDown={hasPhoto ? (e) => handlePhotoDragStart(e, idx) : undefined}
                            onTouchStart={hasPhoto ? (e) => handlePhotoDragStart(e, idx) : undefined}
                          >
                            {hasPhoto ? (
                               <img 
                                 src={getAssetUrl('photo', recentPhotos.find(p => p.name === selectedPhotos[idx]) || selectedPhotos[idx])} 
                                 style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`, pointerEvents: 'none', display: 'block' }} 
                                 alt="Guest"
                               />
                            ) : (
                               idx + 1
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 50 }}>
                {selectedPhotos.length === requiredPhotos && (
                  <button onClick={handleApproveAndPreview} disabled={isProcessing} className="approve-btn" style={{ padding: '8px 16px', fontSize: '0.95rem', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    {isProcessing ? 'Processing...' : 'Proceed'}
                  </button>
                )}
              </div>
            </div>
          </main>
        )
      ) : (
        // --- Template Setup Mode ---
        <main className="main-content setup-layout">
          <div className={`setup-container ${selectedTemplateForEditing ? 'editing-mode' : 'list-mode'}`}>
            {selectedTemplateForEditing ? (
              <>
                <h2>Editing: {selectedTemplateForEditing}</h2>
                <p>Draw up to 4 rectangles on the template where the guest's photos should appear (in order).</p>
                <div className="template-editor" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                  <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto' }} onMouseDown={handleMouseDown}>
                    <img 
                      ref={templateImageRef} 
                      src={getAssetUrl('template', selectedTemplateForEditing)} 
                      alt="Template for setup" 
                      draggable="false"
                      onLoad={handleTemplateImageLoad}
                    />
                    {selectionBoxes.map((box, idx) => (
                      <div key={idx} className="selection-box" style={{
                        left: `${box.x}px`,
                        top: `${box.y}px`,
                        width: `${box.width}px`,
                        height: `${box.height}px`,
                      }}>
                         <div className="box-index">{idx + 1}</div>
                      </div>
                    ))}
                    {currentBox && currentBox.width > 0 && (
                      <div className="selection-box" style={{
                        left: `${currentBox.x}px`,
                        top: `${currentBox.y}px`,
                        width: `${currentBox.width}px`,
                        height: `${currentBox.height}px`,
                      }} />
                    )}
                  </div>
                </div>
                <div className="actions" style={{ flexDirection: 'row', justifyContent: 'center', gap: '15px' }}>
                  <button onClick={handleClearBoxes} className="secondary-btn" type="button">Clear Areas</button>
                  <button onClick={handleSaveConfig} className="save-config-btn">Save Configuration</button>
                  <button onClick={() => setSelectedTemplateForEditing(null)} className="secondary-btn">Back to List</button>
                </div>
              </>
            ) : (
              // --- Settings Page: List Mode ---
              <>
                {/* Top Card: System Configurations (25%) */}
                <div className="config-section system-config-card">
                  <h2>System Configuration</h2>
                  <div className="control-group">
                    <label htmlFor="camera-folder-input" style={{marginBottom: 0}}>Camera Output Folder Path:</label>
                    <div className="input-group" style={{ marginTop: 0, flexGrow: 1, display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        id="camera-folder-input"
                        type="text"
                        value={cameraFolderPath}
                        onChange={(e) => setCameraFolderPath(e.target.value)}
                        placeholder="e.g., C:\Users\YourName\Pictures\PhotoBooth"
                        disabled={isProcessing}
                        style={{ flex: 1, marginBottom: 0 }}
                      />
                      <button onClick={handleBrowseFolder} disabled={isProcessing} className="browse-btn" type="button">
                        Browse...
                      </button>
                      <button onClick={handleSetCameraFolder} disabled={isProcessing} className="save-config-btn">
                        {isProcessing ? 'Setting...' : 'Set Watch Folder'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Card: Template Management (75%) */}
                <div className="config-section template-management-card">
                  <h2>Template Management</h2>
                  <div className="template-gallery">
                    {templates.map(template => (
                      <div key={template} className="template-item">
                        <div className="template-thumbnail-wrapper" onClick={() => handleSelectTemplateForEditing(template)}>
                          <img src={getAssetUrl('template', template)} alt={template} className="template-thumbnail" />
                          <div className="template-hover-overlay">Click to setup image areas</div>
                        </div>
                        <button className="delete-template-btn" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template); }} title={`Delete ${template}`}>&times;</button>
                        <p className="template-name">{template}</p>
                      </div>
                    ))}
                  </div>
                  <div className="upload-container">
                    <h3>Upload New Template</h3>
                    <label htmlFor="template-upload" className={`upload-btn ${isProcessing ? 'disabled' : ''}`}>{isProcessing ? 'Uploading...' : '📂 Browse...'}</label>
                    <input type="file" id="template-upload" accept="image/png, image/jpeg" onChange={handleTemplateUpload} disabled={isProcessing} />
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      {showFolderModal && (
        <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '80%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h2>Select Server Folder</h2>
            <div style={{ padding: '10px', background: 'var(--input-bg)', borderRadius: '4px', marginBottom: '10px', wordBreak: 'break-all', color: 'var(--text-main)' }}>
              <strong>Current:</strong> {browsePath}
            </div>
            <ul style={{ flex: 1, overflowY: 'auto', listStyleType: 'none', padding: 0, margin: '0 0 15px 0', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
              <li 
                onClick={() => fetchDirectories(browsePath + '/..')}
                style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', background: 'var(--item-bg)', color: 'var(--text-main)' }}
              >
                <span style={{ marginRight: '8px' }}>📁</span> .. (Go Up)
              </li>
              {subDirs.map(dir => (
                <li 
                  key={dir} 
                  onClick={() => fetchDirectories(browsePath + '/' + dir)}
                  style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                >
                  <span style={{ marginRight: '8px' }}>📁</span> {dir}
                </li>
              ))}
              {subDirs.length === 0 && <li style={{ padding: '10px', color: 'var(--text-muted)' }}>No subfolders found.</li>}
            </ul>
            <div className="actions" style={{ flexDirection: 'row', marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowFolderModal(false)} className="secondary-btn">Cancel</button>
              <button onClick={() => {
                setCameraFolderPath(browsePath);
                setShowFolderModal(false);
              }} className="approve-btn">✅ Select This Folder</button>
            </div>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="modal-overlay" onClick={() => setShowInstructions(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>How to Use the Photo Booth System</h2>
            <ol>
              <li>
                <strong>System Setup (First Time Only):</strong>
                <ul>
                  <li>Go to "Template Setup" mode.</li>
                  <li>In the "System Configuration" section, provide the full path to the folder where your camera saves new photos.</li>
                  <li>You can paste the path (e.g., `C:\Users\YourName\Pictures\PhotoBooth`) and click "Set Watch Folder".</li>
                  <li><strong>Note:</strong> The "Browse..." button will only work in the final installed application (`.exe`), not in the development browser.</li>
                </ul>
              </li>
              <li>
                <strong>Template Setup:</strong>
                <ul>
                  <li>Switch to "Template Setup" mode.</li>
                  <li>Select a template from the gallery or upload a new one.</li>
                  <li>Click and drag your mouse over the template image to draw up to <strong>4 selection boxes</strong> in the exact order you want the photos to appear.</li>
                  <li>Click "Save Configuration".</li>
                </ul>
              </li>
              <li>
                <strong>Live Booth Operation:</strong>
                <ul>
                  <li>Switch to "Live Booth" mode and choose an "Active Template".</li>
                  <li>Take photos with your camera. They will instantly appear in the thumbnails row.</li>
                  <li>Click on the photos to <strong>select them in order</strong>. You must select the exact number of photos required by the template.</li>
                  <li>Use the "🗑️ Delete" button (or the 'x' on thumbnails) to permanently remove bad photos.</li>
                  <li>Click "Approve & Preview Card" once the required photos are selected.</li>
                </ul>
              </li>
              <li>
                <strong>Final Preview & Finalize:</strong>
                <ul>
                  <li><strong>Adjust:</strong> Click and drag the guest photos in the preview to adjust their positions inside the frames.</li>
                  <li><strong>Print:</strong> Enter the number of copies and click "Print Now".</li>
                  <li><strong>Email:</strong> Enter a guest's email and click "Send Email" (This will also prompt you to save a local backup).</li>
                  <li><strong>Save:</strong> Click "Save as JPG..." to manually download the image.</li>
                  <li><strong>Navigation:</strong> Use the top-left <strong>⬅ Back</strong> arrow to return to selection mode without losing photos, or <strong>❌ Reject</strong> to clear the session and start over.</li>
                </ul>
              </li>
            </ol>
            <button onClick={() => setShowInstructions(false)} className="secondary-btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
