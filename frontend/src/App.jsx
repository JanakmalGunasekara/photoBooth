import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const BACKEND_URL = 'http://localhost:5000'; // Define your backend URL

function App() {
  // Global state
  const [mode, setMode] = useState('live'); // 'live' or 'setup'
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
        const res = await fetch(`${BACKEND_URL}/api/latest-photo`);
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

    if (isPreviewMode) {
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
  }, [isPreviewMode]);

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
    // Instantly transition to Interactive Preview Mode
    setPhotoPositions(Array(requiredPhotos).fill({x: 50, y: 50}));
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

  const handleClearSelection = () => {
    if (isProcessing) return;
    setSelectedPhotos([]);
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
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
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

  // --- Main Render ---
  return (
    <div className="dashboard">
      <style>{`
        .recent-photos-row { display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 15px; padding: 15px 5px; justify-content: flex-start; }
        .recent-photos-row::-webkit-scrollbar { height: 8px; }
        .recent-photos-row::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        .photo-thumbnail { flex: 0 0 auto; position: relative; cursor: pointer; border: 2px solid transparent; width: 110px; height: auto; border-radius: 12px; overflow: hidden; opacity: 0.7; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
        .photo-thumbnail:hover { opacity: 1; transform: translateY(-5px); box-shadow: 0 10px 15px rgba(0,0,0,0.4); }
        .photo-thumbnail.active-highlight { opacity: 1; box-shadow: 0 0 0 3px #ff9a9e, 0 8px 15px rgba(255, 154, 158, 0.4); }
        .photo-thumbnail.selected { opacity: 1; border-color: transparent; box-shadow: 0 0 0 3px #28a745, 0 8px 15px rgba(40, 167, 69, 0.4); }
        .photo-thumbnail img { width: 100%; height: auto; display: block; }
        .photo-thumbnail .badge { position: absolute; top: 6px; right: 6px; background: #28a745; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.4); }
        .selection-box { position: absolute; border: 2px dashed #ff0000; background: rgba(255, 0, 0, 0.2); pointer-events: none; }
        .selection-box .box-index { position: absolute; top: 0; left: 0; background: red; color: white; padding: 2px 6px; font-size: 14px; font-weight: bold; }
        .highlighted-photo-container { margin-top: 15px; background: #181818; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); border-radius: 12px; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 420px; }
        .highlighted-photo-wrapper { position: relative; display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%; }
        .highlighted-img { max-height: 50vh; max-width: 100%; border-radius: 8px; object-fit: contain; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
        .large-badge { position: absolute; top: -10px; right: -10px; background: #28a745; color: white; border-radius: 50%; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 2; }
        .highlighted-actions { display: flex; gap: 10px; }
        .photo-instructions { margin-top: 10px; font-weight: 500; color: #aaa; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; }
        .delete-photo-btn { position: absolute; top: 6px; left: 6px; background: rgba(220, 53, 69, 0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 16px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 5; padding: 0; line-height: 1; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .delete-photo-btn:hover { background: #dc3545; transform: scale(1.15) rotate(90deg); }
        .back-arrow-btn { position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); width: 45px; height: 45px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.5rem; color: #ff9a9e; cursor: pointer; padding: 0; transition: all 0.3s; z-index: 100; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
        .back-arrow-btn:hover { background: var(--accent-pink); color: #121212; transform: translateX(-5px); box-shadow: 0 6px 12px rgba(255, 154, 158, 0.3); }
      `}</style>
      <header className="header">
        <h1>Photo Booth Dashboard</h1>
        <div className="help-icon" onClick={() => setShowInstructions(true)} title="Show Instructions">
          ?
        </div>
        <div className="mode-switcher">
          <button onClick={() => setMode('live')} className={mode === 'live' ? 'active' : ''}>Live Booth</button>
          <button onClick={() => setMode('setup')} className={mode === 'setup' ? 'active' : ''}>Settings</button>
        </div>
      </header>

      {mode === 'live' ? (
        isPreviewMode ? (
          // --- Final Preview and Action Step ---
          <main className="main-content">
            <div className="preview-container" ref={previewContainerRef}>
              <h2>Final Preview (Drag photos to adjust)</h2>
              <div className="photo-review" style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', borderRadius: '8px' }}>
                <img 
                  src={getAssetUrl('template', activeTemplate)} 
                  alt="Final merged card"
                  className="template-bg"
                  style={{ width: '100%', height: 'auto', display: 'block', position: 'relative', zIndex: 10, pointerEvents: 'none' }}
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
            <div className="controls-container" style={{ position: 'relative' }}>
              <button onClick={handleBackToSelection} disabled={isProcessing} className="back-arrow-btn" title="Back to Selection">⬅</button>
              <h2>Finalize</h2>
              <div className="control-group">
                <label htmlFor="printer-select">Select Printer:</label>
                <select id="printer-select" value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} disabled={printers.length === 0 || isProcessing}>
                  {printers.length > 0 ? printers.map(p => <option key={p} value={p}>{p}</option>) : <option>No printers found</option>}
                </select>
              </div>
              <div className="control-group" style={{ flexDirection: 'row', gap: '10px' }}>
                <label htmlFor="print-copies" style={{ fontSize: '1.1em' }}>Copies:</label>
                <input
                  id="print-copies"
                  type="number"
                  min="1"
                  max="50"
                  value={printCopies}
                  onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={isProcessing}
                  style={{ width: '70px', padding: '0.4em', borderRadius: '4px', border: '1px solid #666', backgroundColor: '#444', color: 'white', textAlign: 'center', fontSize: '1.1em' }}
                />
              </div>
              <div className="control-group" style={{ flexDirection: 'row', gap: '10px' }}>
                <label htmlFor="email-input" style={{ fontSize: '1.1em' }}>Email:</label>
                <input
                  id="email-input"
                  type="email"
                  placeholder="guest@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  disabled={isProcessing}
                  style={{ width: '200px', padding: '0.4em', borderRadius: '4px', border: '1px solid #666', backgroundColor: '#444', color: 'white', fontSize: '1.1em' }}
                />
              </div>
              <div className="actions">
                <button onClick={handlePrint} disabled={isProcessing} className="approve-btn">
                  {isProcessing ? 'Printing...' : '🖨️ Print Now'}
                </button>
                <button onClick={handleEmail} disabled={isProcessing || !emailAddress} className="approve-btn" style={{ backgroundColor: '#007bff', borderColor: '#0056b3' }}>
                  {isProcessing ? 'Sending...' : '✉️ Send Email'}
                </button>
                <button onClick={handleDownload} disabled={isProcessing} className="download-btn">
                  💾 Save as JPG...
                </button>
                <button onClick={handleReject} disabled={isProcessing} className="reject-btn">
                  ❌ Reject
                </button>
              </div>
            </div>
          </main>
        ) : (
          // --- Initial Photo Approval Step ---
          <main className="main-content">
            <div className="preview-container">
              <h2>Live Photos</h2>
              <div className="photo-instructions">
                  {requiredPhotos > 1 ? `Select ${requiredPhotos} photos in order for the current template.` : 'Select 1 photo for the current template.'}
              </div>

              <div className="highlighted-photo-container">
                {highlightedPhoto ? (
                    <div className="highlighted-photo-wrapper">
                        <img src={getAssetUrl('photo', recentPhotos.find(p => p.name === highlightedPhoto) || highlightedPhoto)} alt="Highlighted" className="highlighted-img" />
                        {selectedPhotos.includes(highlightedPhoto) && (
                            <div className="large-badge">{selectedPhotos.indexOf(highlightedPhoto) + 1}</div>
                        )}
                        <div className="highlighted-actions">
                            <button
                                className={selectedPhotos.includes(highlightedPhoto) ? 'reject-btn' : 'approve-btn'}
                                onClick={() => togglePhotoSelection(highlightedPhoto)}
                                disabled={!selectedPhotos.includes(highlightedPhoto) && selectedPhotos.length >= requiredPhotos}
                            >
                                {selectedPhotos.includes(highlightedPhoto) ? '❌ Deselect Photo' : '✅ Select Photo'}
                            </button>
                            <button
                                className="reject-btn"
                                onClick={(e) => handleDeletePhoto(highlightedPhoto, e)}
                                disabled={isProcessing}
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="no-photo"><p>Waiting for new photos...</p></div>
                )}
              </div>

              {recentPhotos.length > 0 && (
                <div className="recent-photos-row">
                  {recentPhotos.slice(0, 6).map(photo => {
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
                </div>
              )}
            </div>
            <div className="controls-container">
              <h2>Controls</h2>
              <div className="control-group">
                <label htmlFor="template-select">Active Template:</label>
                <select id="template-select" value={activeTemplate} onChange={(e) => { setActiveTemplate(e.target.value); setSelectedPhotos([]); setLiveTemplateBoxes([]); }} disabled={templates.length === 0 || isProcessing}>
                  {templates.length > 0 ? templates.map(t => <option key={t} value={t}>{t}</option>) : <option>No templates found</option>}
                </select>
              </div>

              {activeTemplate && (
                <div className="live-template-preview" style={{ marginTop: '15px', textAlign: 'center' }}>
                  <p style={{fontSize: '0.9rem', marginBottom: '10px', fontWeight: 'bold'}}>Template Layout (Photo Order):</p>
                  <div style={{ position: 'relative', width: '100%', maxWidth: '200px', margin: '0 auto' }}>
                    <img 
                      src={getAssetUrl('template', activeTemplate)} 
                      alt="Layout Preview"
                      style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                      onLoad={(e) => {
                         const img = e.target;
                         const config = appConfig[activeTemplate];
                         if (config) {
                           let areas = config.areas || (config.x !== undefined ? [config] : []);
                           const naturalW = img.naturalWidth;
                           const naturalH = img.naturalHeight;
                           setLiveTemplateBoxes(areas.map(area => ({
                              left: `${(area.x / naturalW) * 100}%`,
                              top: `${(area.y / naturalH) * 100}%`,
                              width: `${(area.width / naturalW) * 100}%`,
                              height: `${(area.height / naturalH) * 100}%`
                           })));
                         }
                      }}
                    />
                    {liveTemplateBoxes.map((box, idx) => (
                      <div key={idx} style={{ position: 'absolute', border: '2px solid #4CAF50', background: 'rgba(76, 175, 80, 0.4)', left: box.left, top: box.top, width: box.width, height: box.height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', textShadow: '1px 1px 2px black' }}>
                        {idx + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="actions">
                {selectedPhotos.length === requiredPhotos && (
                  <button onClick={handleApproveAndPreview} disabled={isProcessing} className="approve-btn">
                    {isProcessing ? 'Processing...' : '✅ Approve & Preview Card'}
                  </button>
                )}
                <button onClick={handleClearSelection} disabled={selectedPhotos.length === 0 || isProcessing} className="reject-btn">
                  ❌ Clear Selection
                </button>
              </div>
            </div>
          </main>
        )
      ) : (
        // --- Template Setup Mode ---
        <main className="main-content setup-layout">
          <div className="setup-container">
            {selectedTemplateForEditing ? (
              <>
                <h2>Editing: {selectedTemplateForEditing}</h2>
                <p>Draw up to 4 rectangles on the template where the guest's photos should appear (in order).</p>
                <div className="template-editor" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
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
                <div className="actions">
                  <button onClick={handleClearBoxes} className="reject-btn" type="button">Clear Areas</button>
                  <button onClick={handleSaveConfig} className="save-config-btn">💾 Save Configuration</button>
                  <button onClick={() => setSelectedTemplateForEditing(null)} className="reject-btn">Back to List</button>
                </div>
              </>
            ) : (
              <>
                <div className="config-section">
                  <h2>System Configuration</h2>
                  <div className="control-group">
                    <label htmlFor="camera-folder-input">Camera Output Folder Path:</label>
                    <div className="input-group" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input
                        id="camera-folder-input"
                        type="text"
                        value={cameraFolderPath}
                        onChange={(e) => setCameraFolderPath(e.target.value)}
                        placeholder="e.g., C:\Users\YourName\Pictures\PhotoBooth"
                        disabled={isProcessing}
                        style={{ flex: 1 }}
                      />
                      <button onClick={handleBrowseFolder} disabled={isProcessing} className="browse-btn" type="button">
                        Browse...
                      </button>
                    </div>
                    <button onClick={handleSetCameraFolder} disabled={isProcessing} className="save-config-btn">
                      {isProcessing ? 'Setting...' : 'Set Watch Folder'}
                    </button>
                  </div>
                </div>

                <h2>Template Management</h2>
                <div className="template-gallery">
                  {templates.map(template => (
                    <div key={template} className="template-item">
                      <img
                        src={getAssetUrl('template', template)}
                        alt={template}
                        className="template-thumbnail"
                        onClick={() => handleSelectTemplateForEditing(template)}
                      />
                      <button
                        className="delete-template-btn"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent image click when deleting
                          handleDeleteTemplate(template);
                        }}
                        title={`Delete ${template}`}
                      >&times;</button>
                      <p className="template-name">{template}</p>
                    </div>
                  ))}
                </div>
                <div className="upload-container">
                  <h3>Or Upload a New Template</h3>
                  <label htmlFor="template-upload" className={`upload-btn ${isProcessing ? 'disabled' : ''}`}>
                    {isProcessing ? 'Uploading...' : '📂 Choose File'}
                  </label>
                  <input type="file" id="template-upload" accept="image/png, image/jpeg" onChange={handleTemplateUpload} disabled={isProcessing} />
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
            <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px', marginBottom: '10px', wordBreak: 'break-all', color: '#333' }}>
              <strong>Current:</strong> {browsePath}
            </div>
            <ul style={{ flex: 1, overflowY: 'auto', listStyleType: 'none', padding: 0, margin: '0 0 15px 0', border: '1px solid #ddd', borderRadius: '4px' }}>
              <li 
                onClick={() => fetchDirectories(browsePath + '/..')}
                style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee', background: '#fafafa', color: '#000' }}
              >
                <span style={{ marginRight: '8px' }}>📁</span> .. (Go Up)
              </li>
              {subDirs.map(dir => (
                <li 
                  key={dir} 
                  onClick={() => fetchDirectories(browsePath + '/' + dir)}
                  style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee', color: '#000' }}
                >
                  <span style={{ marginRight: '8px' }}>📁</span> {dir}
                </li>
              ))}
              {subDirs.length === 0 && <li style={{ padding: '10px', color: '#888' }}>No subfolders found.</li>}
            </ul>
            <div className="actions" style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowFolderModal(false)} className="reject-btn">Cancel</button>
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
            <button onClick={() => setShowInstructions(false)} className="reject-btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
