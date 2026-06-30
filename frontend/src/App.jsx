import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import UpdatePassword from './UpdatePassword';
import photoboothLogo from './assets/photoboothlogo.png';

const BACKEND_URL = 'http://localhost:5000'; // Define your backend URL

const getDisplayText = (t) => {
    const lines = (t.text || '').split('\n');
    
    const toRoman = (num) => {
        const lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
        let roman = '', i;
        for (i in lookup) {
            while (num >= lookup[i]) { roman += i; num -= lookup[i]; }
        }
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
    }).join('\n');
};

const getTextStyleOptions = (t, scale = 1) => {
    let shadows = [];
    let WebkitTextStroke = 'none';
    let WebkitTextFillColor = 'initial';
    let bgColor = 'transparent';
    let bgImage = 'none';
    let padding = '0';
    let color = t.color || '#000000';
    const fs = (t.fontSize || 50) * scale;
    
    // Legacy effect conversion support
    const effects = t.effects || {};

    if (effects.drop?.enabled) { 
        const d = (effects.drop.distance ?? 5) * scale;
        const a = (effects.drop.angle ?? 45) * Math.PI/180;
        const c = effects.drop.color ?? '#000000';
        shadows.push(`${Math.cos(a) * d}px ${Math.sin(a) * d}px 0px ${c}`); 
    }
    if (effects.glow?.enabled) { 
        const intensity = (effects.glow.intensity ?? 10) * scale;
        const c = effects.glow.color ?? '#ff0000';
        shadows.push(`0 0 ${intensity}px ${c}`, `0 0 ${intensity * 2}px ${c}`); 
    }
    if (effects.echo?.enabled) { 
        const d = (effects.echo.distance ?? 5) * scale;
        const a = (effects.echo.angle ?? 45) * Math.PI/180;
        const c = effects.echo.color ?? '#000000';
        shadows.push(`${Math.cos(a) * d}px ${Math.sin(a) * d}px 0 ${c}`, `${Math.cos(a) * d * 2}px ${Math.sin(a) * d * 2}px 0 rgba(0,0,0,0.4)`); 
    }
    if (effects.outline?.enabled) { 
        const thickness = (effects.outline.thickness ?? 2) * scale;
        const c = effects.outline.color ?? '#000000';
        WebkitTextStroke = `${thickness}px ${c}`; 
    }
    if (effects.hollow?.enabled) { 
        const thickness = (effects.hollow.thickness ?? 2) * scale;
        WebkitTextStroke = `${thickness}px ${color}`; 
        WebkitTextFillColor = 'transparent'; 
    }
    if (effects.splice?.enabled) { 
        const thickness = (effects.splice.thickness ?? 2) * scale;
        const d = (effects.splice.distance ?? 5) * scale;
        const a = (effects.splice.angle ?? 45) * Math.PI/180;
        const c = effects.splice.color ?? '#000000';
        WebkitTextStroke = `${thickness}px ${color}`; 
        WebkitTextFillColor = 'transparent'; 
        shadows.push(`${Math.cos(a) * d}px ${Math.sin(a) * d}px 0 ${c}`); 
    }
    if (effects.neon?.enabled) { 
        const c = effects.neon.color ?? '#ff00ff';
        shadows.push(`0 0 ${fs*0.05}px #fff`, `0 0 ${fs*0.1}px #fff`, `0 0 ${fs*0.2}px ${c}`, `0 0 ${fs*0.3}px ${c}`); 
        color = '#fff'; WebkitTextFillColor = '#fff'; 
    }
    if (effects.glitch?.enabled) { shadows.push(`${fs*0.04}px 0 0 cyan`, `-${fs*0.04}px 0 0 red`); }
    if (effects.background?.enabled) { bgColor = effects.background.color ?? '#ffff00'; padding = `${fs*0.2}px ${fs*0.4}px`; }
    
    if (shadows.length === 0 && WebkitTextStroke === 'none' && bgColor === 'transparent') {
        shadows.push('0 0 5px rgba(255,255,255,0.3)');
    }

    let bgClip = effects.background?.enabled ? 'padding-box' : 'initial';
    if (t.fillType === 'gradient') {
        bgImage = `linear-gradient(${t.gradientAngle || 90}deg, ${t.color || '#000'}, ${t.color2 || '#fff'})`;
        bgColor = 'transparent';
        WebkitTextFillColor = 'transparent';
        color = 'transparent';
        bgClip = 'text';
    }

    return {
        fontWeight: t.fontWeight === 'normal' ? 'normal' : 'bold',
        fontStyle: t.fontStyle || 'normal',
        textDecoration: t.textDecoration || 'none',
        textShadow: shadows.join(', ') || 'none',
        WebkitTextStroke,
        WebkitTextFillColor,
        backgroundImage: bgImage,
        backgroundColor: bgColor,
        WebkitBackgroundClip: bgClip,
        backgroundClip: bgClip,
        padding,
        color,
        opacity: t.opacity ?? 1,
        borderRadius: effects.background?.enabled ? '8px' : '0'
    };
};

function App() {
  const [session, setSession] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const isDefaultTemplateName = (name, config) => (config.defaultTemplateList || []).includes(name);
  const isCustomTemplateName = (name, config) => !isDefaultTemplateName(name, config);

  const FONT_OPTIONS = ['Arial', 'Verdana', 'Times New Roman', 'Georgia', 'Courier New', 'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', 'Edwardian Script ITC', 'Vivaldi', 'Freestyle Script', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact', 'Lucida Sans Unicode', 'Tahoma', 'Garamond'];
  const WORD_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72, 96, 144];
  const DEFAULT_COLORS = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF', '#808080', '#C0C0C0'];
  
  const [recentColors, setRecentColors] = useState([]);
  const [templateColors, setTemplateColors] = useState([]);
  const DEFAULT_GRADIENTS = [
      { c1: '#ff9a9e', c2: '#fecfef' }, { c1: '#a18cd1', c2: '#fbc2eb' }, { c1: '#ff0844', c2: '#ffb199' }, { c1: '#4facfe', c2: '#00f2fe' }
  ];

  // Global state
  const [mode, setMode] = useState('live'); // 'live' or 'setup'
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [headerClicks, setHeaderClicks] = useState(0);

  // Live Booth Mode State
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false); // To show the interactive editor
  const [photoPositions, setPhotoPositions] = useState([]); // Array of {x: 50, y: 50}
  const [templateScale, setTemplateScale] = useState(1);
  const [templateDims, setTemplateDims] = useState({ width: 1000, height: 1000 });
  const previewContainerRef = useRef(null);
  const [highlightedPhoto, setHighlightedPhoto] = useState(null); // To view a single photo clearly
  const [liveTemplateBoxes, setLiveTemplateBoxes] = useState([]); // To preview layout in live mode
  const [livePreviewScale, setLivePreviewScale] = useState(1);
  const [livePreviewDims, setLivePreviewDims] = useState({ width: 1000, height: 1000 });
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printCopies, setPrintCopies] = useState(1);
  const [emailAddress, setEmailAddress] = useState('');
  const [templates, setTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState('');
  const [enabledDefaultTemplates, setEnabledDefaultTemplates] = useState([]);
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
  const [setupTexts, setSetupTexts] = useState([]);
  const templateImageRef = useRef(null);
  const lastPhotoNameRef = useRef(null);
  const lastUpdateRef = useRef(null); // Ref to track overall session updates
  const dragRef = useRef({ isDragging: false, index: -1, startX: 0, startY: 0, startPos: {x:50, y:50} });

  const [selectedTextIndex, setSelectedTextIndex] = useState(null);
  const textDragRef = useRef({ isDragging: false, index: -1 });
  const [editorZoom, setEditorZoom] = useState(1);
  const [setupTemplateDims, setSetupTemplateDims] = useState({ width: 1000, height: 1000 });
  const [activeEditorTab, setActiveEditorTab] = useState('format'); // 'format', 'effects'
  const [expandedEffect, setExpandedEffect] = useState(null);
  const [editorTool, setEditorTool] = useState('move'); // 'move', 'draw', 'shapes'
  const [isTextDragging, setIsTextDragging] = useState(false);
  const [showGridLines, setShowGridLines] = useState(true);
  const [snapLines, setSnapLines] = useState([]);
  const [distanceLines, setDistanceLines] = useState([]);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    itemIndex: null,
  });
  const [setupShapes, setSetupShapes] = useState([]);
  const [selectedShapeIndex, setSelectedShapeIndex] = useState(null);
  const shapeDragRef = useRef({ isDragging: false, index: -1, offsetX: 0, offsetY: 0 });
  const transformRef = useRef({ isTransforming: false, type: null, itemType: null, index: -1, startX: 0, startY: 0, startW: 0, startH: 0, startXPos: 0, startYPos: 0, startRotation: 0, centerX: 0, centerY: 0 });



  // --- Theme Effect ---
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // --- Auth State Change Listener ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
          const hasEnabledDefaultTemplates = Object.prototype.hasOwnProperty.call(config, 'enabledDefaultTemplates');
          if (hasEnabledDefaultTemplates) {
            setEnabledDefaultTemplates(Array.isArray(config.enabledDefaultTemplates) ? config.enabledDefaultTemplates : []);
          } else if (templateList.length > 0 && config.defaultTemplateList) {
            setEnabledDefaultTemplates(templateList.filter(t => isDefaultTemplateName(t, config)));
          }
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
  }, [mode, session]); // Re-run effect if mode or session changes

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

  // --- Resize Handler for Final Preview ---
  useEffect(() => {
    const handleResize = () => {
      const img = document.querySelector('.template-bg');
      if (img && img.naturalWidth) {
         // getBoundingClientRect is more precise (returns decimals) than clientWidth
         setTemplateScale(img.getBoundingClientRect().width / img.naturalWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    
    let observer;
    setTimeout(() => {
        const reviewBox = document.querySelector('.photo-review');
        if (reviewBox && window.ResizeObserver) {
            observer = new ResizeObserver(handleResize);
            observer.observe(reviewBox);
        }
    }, 100);

    return () => {
        window.removeEventListener('resize', handleResize);
        if (observer) observer.disconnect();
    };
  }, [isPreviewMode, activeTemplate]);

  // Helper to get the correct asset URL based on environment
  const getAssetUrl = (type, item) => {
    const isDefault = type === 'template' && isDefaultTemplateName(item, appConfig);
    if (item && typeof item === 'object') {
      return `${BACKEND_URL}/photos/${item.name}?t=${item.timestamp || ''}`;
    }
    const folder = isDefault ? 'defaults' : `${type}s`;
    return `${BACKEND_URL}/${folder}/${item}`;
  };

  // Number of areas for active template
  const activeTemplateConfig = appConfig[activeTemplate] || {};
  const availableTemplatesForLive = templates.filter(t => isCustomTemplateName(t, appConfig) || enabledDefaultTemplates.includes(t));
  const availableTemplatesKey = availableTemplatesForLive.join('|');
  const requiredPhotos = activeTemplate ? (activeTemplateConfig.areas ? activeTemplateConfig.areas.length : (activeTemplateConfig.x ? 1 : 1)) : 0;

  useEffect(() => {
    // If the currently active template is no longer available (e.g., it was disabled),
    // switch to the first available template.
    if (activeTemplate && !availableTemplatesForLive.includes(activeTemplate)) {
      setActiveTemplate(availableTemplatesForLive[0] || '');
    } else if (activeTemplate) {
      // Otherwise, just reset selections for the new template
      setSelectedPhotos([]);
      setLiveTemplateBoxes([]);
    }
  }, [activeTemplate, availableTemplatesKey]);

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

    if (isPreviewMode) {
        if (window.confirm("Are you sure you want to cancel and start a new session? All selected photos will be cleared.")) {
            await resetSession();
        }
    } else {
        await resetSession();
    }
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

  const handleAddText = () => {
    const newIdx = setupTexts.length;
    
    // Default width for new text boxes to make them resizable
    const defaultEffects = {
        drop: { enabled: false, color: '#000000', distance: 5, angle: 45 },
        glow: { enabled: false, color: '#ff0000', intensity: 10 },
        echo: { enabled: false, color: '#000000', distance: 5, angle: 45 },
        outline: { enabled: false, color: '#000000', thickness: 2 },
        hollow: { enabled: false, thickness: 2 },
        splice: { enabled: false, color: '#000000', distance: 5, angle: 45, thickness: 2 },
        neon: { enabled: false, color: '#ff00ff' },
        glitch: { enabled: false },
        background: { enabled: false, color: '#ffff00' }
    };

    setSetupTexts(prev => [...prev, {
        id: `text_${Date.now()}`,
        text: 'New Text',
        x: 150,
        y: 150,
        width: 200, // Default width
        fontSize: 50,
        rotation: 0,
        fillType: 'solid',
        color: isDarkMode ? '#FFFFFF' : '#000000',
        color2: '#ff0000',
        gradientAngle: 90,
        fontFamily: 'Arial',
        textAlign: 'center',
        letterSpacing: 0,
        lineHeight: 1.2,
        fontWeight: 'bold',
        listType: 'none',
        effects: defaultEffects,
        opacity: 1
    }]);
    setSelectedTextIndex(newIdx);
  };

  const handleDuplicateText = (index) => {
    if (index === null || !setupTexts[index]) return;
    const originalText = setupTexts[index];
    const newText = {
      ...JSON.parse(JSON.stringify(originalText)), // Deep copy
      id: `text_${Date.now()}`,
      x: originalText.x + 20, // Offset the new text
      y: originalText.y + 20,
    };
    const newIndex = setupTexts.length;
    setSetupTexts(prev => [...prev, newText]);
    setSelectedTextIndex(newIndex);
  };

  const handleTextContextMenu = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTextIndex(index);
    setContextMenu({
      visible: true, x: e.clientX, y: e.clientY, itemIndex: index
    });
  };

  const handleRemoveText = (index) => {
      setSetupTexts(prev => prev.filter((_, i) => i !== index));
      if (selectedTextIndex === index) {
          setSelectedTextIndex(null);
          setExpandedEffect(null);
      }
  };

  const handleTextChange = (index, key, value) => {
      setSetupTexts(prev => {
          const updated = [...prev];
          let parsedValue = value;
          if (key === 'fontSize' || key === 'letterSpacing') {
              if (value === '') {
                  parsedValue = '';
              } else {
                  parsedValue = parseInt(value, 10);
                  if (isNaN(parsedValue)) parsedValue = key === 'fontSize' ? 1 : 0;
                  if (key === 'fontSize' && parsedValue < 1) parsedValue = 1;
              }
          } else if (key === 'lineHeight') {
              if (value === '') {
                  parsedValue = '';
              } else {
                  parsedValue = parseFloat(value);
                  if (isNaN(parsedValue)) parsedValue = 1.2;
              }
          } else if (key === 'opacity') {
              parsedValue = parseFloat(value);
              if (isNaN(parsedValue)) {
                  parsedValue = 1;
              }
          }
          updated[index] = { ...updated[index], [key]: parsedValue };
          return updated;
      });

      // Add to recent colors
      if (key === 'color' && value.match(/^#[0-9a-f]{6}$/i)) {
          setRecentColors(prev => {
              const newColors = [value, ...prev.filter(c => c !== value)];
              return newColors.slice(0, 5); // Keep only the last 5
      });
    }
  };

  const handleEffectChange = (textIndex, effectName, key, value) => {
      setSetupTexts(prev => {
          const updated = [...prev];
          const textObj = updated[textIndex];
          const currentEffects = textObj.effects || {};
          const currentSpecificEffect = currentEffects[effectName] || {};
          
          updated[textIndex] = {
              ...textObj,
              effects: {
                  ...currentEffects,
                  [effectName]: {
                      ...currentSpecificEffect,
                      [key]: value
                  }
              }
          };
          return updated;
      });
  };

  const handleTextAlignChange = (index, newAlign) => {
      const textElem = document.getElementById(`setup-text-${index}`);
      if (!textElem || !templateImageRef.current) {
          handleTextChange(index, 'textAlign', newAlign);
          return;
      }
      
      setSetupTexts(prev => {
          const updated = [...prev];
          const t = updated[index];
          const oldAlign = t.textAlign || 'center';
          if (oldAlign === newAlign) return prev;

          const rect = textElem.getBoundingClientRect();
          const imgRect = templateImageRef.current.getBoundingClientRect();
          const scaleX = setupTemplateDims.width / imgRect.width;
          const textWidthInSVG = rect.width * scaleX;

          let newX = t.x;
          let leftEdgeX;
          if (oldAlign === 'center') leftEdgeX = t.x - textWidthInSVG / 2;
          else if (oldAlign === 'right') leftEdgeX = t.x - textWidthInSVG;
          else leftEdgeX = t.x;

          if (newAlign === 'center') newX = leftEdgeX + textWidthInSVG / 2;
          else if (newAlign === 'right') newX = leftEdgeX + textWidthInSVG;
          else newX = leftEdgeX;

          updated[index] = { ...t, textAlign: newAlign, x: newX };
          return updated;
      });
  };

  const handleLayerChange = (index, action) => {
      setSetupTexts(prev => {
          const updated = [...prev];
          if (updated.length <= 1) return prev;
          const item = updated.splice(index, 1)[0];
          let newIndex = index;
          
          if (action === 'forward') {
              newIndex = Math.min(updated.length, index + 1);
              updated.splice(newIndex, 0, item);
          } else if (action === 'backward') {
              newIndex = Math.max(0, index - 1);
              updated.splice(newIndex, 0, item);
          } else if (action === 'front') {
              newIndex = updated.length;
              updated.push(item);
          } else if (action === 'back') {
              newIndex = 0;
              updated.unshift(item);
          }
          setSelectedTextIndex(newIndex);
          return updated;
      });
  };

  const handleTextDragStart = (e, index) => {
      e.stopPropagation();
      setSelectedShapeIndex(null);
      setSelectedTextIndex(index);

      // Don't start dragging if we are double-clicked to edit inline
      if (e.target.contentEditable === "true") return;
      
      const img = templateImageRef.current;
      if (!img) return;
      const rect = img.getBoundingClientRect();

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const { x: startX, y: startY } = setupTexts[index];

      textDragRef.current = { isDragging: true, index };
      setIsTextDragging(true);
      
      const handleTextDragMove = (moveEvent) => {
          if (!textDragRef.current.isDragging) return;
          
          const deltaX = moveEvent.clientX - startMouseX;
          const deltaY = moveEvent.clientY - startMouseY;

          const scaleX = setupTemplateDims.width / rect.width;
          const scaleY = setupTemplateDims.height / rect.height;
          
          let newX = startX + (deltaX * scaleX);
          let newY = startY + (deltaY * scaleY);

          const t = setupTexts[index]; // Get current text object for alignment checks

          // --- Snapping Logic ---
          const newSnapLines = [];
          const newDistanceLines = [];
          if (showGridLines) {
              const SNAP_THRESHOLD = 5 / editorZoom; // 5px threshold, adjusted for zoom
              const draggingElem = document.getElementById(`setup-text-${index}`);
              if (draggingElem) {
                  const draggingRect = draggingElem.getBoundingClientRect();
                  const draggingWidth = draggingRect.width * scaleX;
                  const draggingHeight = draggingRect.height * scaleY; // This might be inaccurate for multi-line text

                  const draggingBounds = {
                      left: newX,
                      top: newY,
                      right: newX + draggingWidth,
                      bottom: newY + draggingHeight,
                      centerX: newX,
                      centerY: newY
                  };

                  // Center of template
                  const templateCenterX = setupTemplateDims.width / 2;
                  const templateCenterY = setupTemplateDims.height / 2;

                  if (Math.abs(draggingBounds.centerX - templateCenterX) < SNAP_THRESHOLD) {
                      newX = templateCenterX; // This needs adjustment based on text-align
                      newSnapLines.push({ type: 'vertical', position: templateCenterX });
                  }
                  if (Math.abs(draggingBounds.centerY - templateCenterY) < SNAP_THRESHOLD) {
                      newY = templateCenterY; // This needs adjustment based on text-align
                      newSnapLines.push({ type: 'horizontal', position: templateCenterY });
                  }

                  // Other text elements
                  setupTexts.forEach((otherText, otherIndex) => {
                      if (index === otherIndex) return;
                      const otherElem = document.getElementById(`setup-text-${otherIndex}`);
                      if (!otherElem) return;

                      const otherRect = otherElem.getBoundingClientRect();
                      const otherWidth = otherRect.width * scaleX;
                      const otherHeight = otherRect.height * scaleY;
                      const otherBounds = {
                          left: otherText.x,
                          top: otherText.y,
                          right: otherText.x + otherWidth,
                          bottom: otherText.y + otherHeight,
                          centerX: otherText.x, // This is also not the center anymore
                          centerY: otherText.y
                      };

                      // Compare centers
                      if (Math.abs(draggingBounds.centerX - otherBounds.centerX) < SNAP_THRESHOLD) {
                          newX = otherBounds.centerX;
                          newSnapLines.push({ type: 'vertical', position: otherBounds.centerX });
                      }
                      if (Math.abs(draggingBounds.centerY - otherBounds.centerY) < SNAP_THRESHOLD) {
                          newY = otherBounds.centerY;
                          newSnapLines.push({ type: 'horizontal', position: otherBounds.centerY });
                      }

                      // Distance lines
                      const yDist = Math.abs(draggingBounds.top - otherBounds.bottom);
                      if (yDist < SNAP_THRESHOLD * 4 && yDist > 0.1) {
                          newDistanceLines.push({ type: 'vertical', start: otherBounds.bottom, end: draggingBounds.top, x: draggingBounds.centerX, dist: yDist });
                      }
                      const xDist = Math.abs(draggingBounds.left - otherBounds.right);
                       if (xDist < SNAP_THRESHOLD * 4 && xDist > 0.1) {
                          newDistanceLines.push({ type: 'horizontal', start: otherBounds.right, end: draggingBounds.left, y: draggingBounds.centerY, dist: xDist });
                      }
                  });
              }
          }
          setSnapLines(newSnapLines);
          setDistanceLines(newDistanceLines);

          // Constrain dragging within the template boundaries
          newX = Math.max(0, Math.min(newX, setupTemplateDims.width));
          newY = Math.max(0, Math.min(newY, setupTemplateDims.height));

          setSetupTexts(prev => {
              const updated = [...prev];
              if (updated[index]) {
                  updated[index] = { ...updated[index], x: newX, y: newY };
              }
              return updated;
          });
      };

      const handleTextDragEnd = () => {
          textDragRef.current.isDragging = false;
          setIsTextDragging(false);
          setDistanceLines([]);
          setSnapLines([]); // Clear lines on mouse up
          window.removeEventListener('mousemove', handleTextDragMove);
          window.removeEventListener('mouseup', handleTextDragEnd);
      };
          
      window.addEventListener('mousemove', handleTextDragMove);
      window.addEventListener('mouseup', handleTextDragEnd);
  };
  // --- Template Setup Mode Handlers ---
  const getCoords = (e) => {
    const img = templateImageRef.current;
    const rect = img.getBoundingClientRect();
    // The rect gives us the on-screen (zoomed) dimensions. We need to map the mouse position
    // to a coordinate space relative to the original image dimensions.
    return {
      x: ((e.clientX - rect.left) / rect.width) * setupTemplateDims.width,
      y: ((e.clientY - rect.top) / rect.height) * setupTemplateDims.height,
    };
  };

  const handleMouseDown = (e) => {
    if (mode !== 'setup') return;
    if (selectionBoxes.length >= 4) {
      // console.warn("Maximum of 4 selection areas allowed.");
      return;
    }
    if (editorTool === 'draw') setIsDrawing(true);
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

  const handleSelectTemplateForEditing = (template, initialTool = 'move') => {
    setSelectedTemplateForEditing(template);
    setEditorZoom(0.5);
    setEditorTool(initialTool);
    setSelectedTextIndex(null);
    setSelectedShapeIndex(null);
    const config = appConfig[template];
    setSelectionBoxes(config?.areas ? [...config.areas] : []);
    setSetupShapes(config?.shapes ? JSON.parse(JSON.stringify(config.shapes)) : []);
    setSetupTexts(config?.texts ? JSON.parse(JSON.stringify(config.texts)) : []);
  };


  const handleTemplateImageLoad = (e) => {
    const img = e.target;
    setSetupTemplateDims({ width: img.naturalWidth || 1000, height: img.naturalHeight || 1000 });
    
    // Extract Dominant Colors for Palette
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 50; canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        const colorCounts = {};
        for(let i=0; i<data.length; i+=4) {
            if(data[i+3] > 128) { // ignore transparent pixels
                const r = Math.round(data[i]/32)*32, g = Math.round(data[i+1]/32)*32, b = Math.round(data[i+2]/32)*32;
                const hex = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
                colorCounts[hex] = (colorCounts[hex]||0)+1;
            }
        }
        setTemplateColors(Object.entries(colorCounts).sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0, 10));
    } catch(err) { console.warn("Color extraction failed", err); }

    const config = appConfig[selectedTemplateForEditing];
    
    if (config) {
      let areas = config.areas;
      if (!areas && config.x !== undefined) {
        areas = [{ x: config.x, y: config.y, width: config.width, height: config.height }];
      }
      
      if (areas && areas.length > 0) {
        setSelectionBoxes([...areas]);
        setSetupShapes(config.shapes ? JSON.parse(JSON.stringify(config.shapes)) : []);
      }
    }
  };

  const handleSaveConfig = async () => {
    const realCoordsArray = selectionBoxes;

    try {
      const newConfig = { ...appConfig };
      if (!newConfig[selectedTemplateForEditing]) {
        newConfig[selectedTemplateForEditing] = {};
      }
      newConfig[selectedTemplateForEditing].areas = realCoordsArray;
      if (setupTexts && setupTexts.length > 0) {
          newConfig[selectedTemplateForEditing].texts = setupTexts;
      }
      if (setupShapes && setupShapes.length > 0) {
          newConfig[selectedTemplateForEditing].shapes = setupShapes;
      }

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
      setSetupShapes([]);
      setSetupTexts([]);
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

  const handleTemplateUpload = async (event, isDefault = false) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('isDefault', isDefault);
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
        if (isDefault) {
          const newDefaultList = [...(appConfig.defaultTemplateList || []), file.name];
          const newConfig = { ...appConfig, defaultTemplateList: newDefaultList };
          await fetch(`${BACKEND_URL}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig),
          });
          setAppConfig(newConfig);
        }
      }
      console.log(`Template '${file.name}' uploaded successfully!`);
    } catch (error) {
      console.error('Failed to upload template. See console for details.', error);
    } finally {
      setIsProcessing(false);
      event.target.value = null; // Clear the input so the same file can be uploaded again if needed
    }
  };

  const handleDefaultTemplateUpload = async (event) => {
    handleTemplateUpload(event, true);
  };

  const handleToggleDefaultTemplate = async (templateName) => {
    const isCurrentlyEnabled = enabledDefaultTemplates.includes(templateName);
    const newEnabledList = isCurrentlyEnabled
      ? enabledDefaultTemplates.filter(t => t !== templateName)
      : [...enabledDefaultTemplates, templateName];

    setEnabledDefaultTemplates(newEnabledList);

    // Save this change to the backend config
    try {
      const newConfig = { ...appConfig, enabledDefaultTemplates: newEnabledList };

      const res = await fetch(`${BACKEND_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });

      if (!res.ok) {
        throw new Error('Failed to save enabled templates configuration');
      }

      setAppConfig(newConfig);
      console.log(`Default template selection updated.`);
    } catch (error) {
      console.error("Failed to save configuration.", error);
      // Optionally revert the state change on error
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
        const rect = img.getBoundingClientRect();
        if (!naturalWidth || !naturalHeight) return;
        setLivePreviewDims({ width: naturalWidth, height: naturalHeight });
        setLivePreviewScale(rect.width / naturalWidth);
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
    window.addEventListener('resize', handleLoad);
    
    let observer;
    setTimeout(() => {
        const liveWrapper = document.querySelector('.live-template-preview-wrapper');
        if (liveWrapper && window.ResizeObserver) {
            observer = new ResizeObserver(handleLoad);
            observer.observe(liveWrapper);
        }
    }, 100);

    return () => {
        window.removeEventListener('template-loaded', handleLoad);
        window.removeEventListener('resize', handleLoad);
        if (observer) observer.disconnect();
    };
  }, [activeTemplate, appConfig, mode, isPreviewMode]);

  const defaultTemplates = templates.filter(t => isDefaultTemplateName(t, appConfig));
  const customTemplates = templates.filter(t => isCustomTemplateName(t, appConfig));

  const isDefaultTemplate = selectedTemplateForEditing && isDefaultTemplateName(selectedTemplateForEditing, appConfig);
  const isDrawingAllowed = (!isDefaultTemplate && editorTool === 'draw') || (isDefaultTemplate && isDeveloperMode && editorTool === 'draw');
  const isDrawingLocked = !isDrawingAllowed;

  // --- Context Menu Close Handler ---
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, itemIndex: null });
      }
    };

    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.visible]);

  const PREDEFINED_SHAPES = {
    rect: { type: 'rect', width: 150, height: 150 },
    ellipse: { type: 'ellipse', width: 150, height: 150 },
    triangle: { type: 'polygon', points: '50,0 100,100 0,100', width: 100, height: 100 },
    star: { type: 'polygon', points: '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35', width: 100, height: 100 },
    arrow: { type: 'polygon', points: '0,25 50,25 50,0 100,50 50,100 50,75 0,75', width: 100, height: 100 },
    heart: { type: 'path', d: 'M50,90 C-20,40 20,-10 50,20 C80,-10 120,40 50,90 Z', width: 100, height: 100 },
  };

  const handleAddShape = (shapeKey) => {
    const shapeProps = PREDEFINED_SHAPES[shapeKey];
    const newShape = {
      id: `shape_${Date.now()}`,
      ...shapeProps,
      x: 200,
      y: 200,
      rotation: 0,
      fill: '#ff9a9e80',
      stroke: '#ff9a9e',
      strokeWidth: 4,
    };
    setSetupShapes(prev => [...prev, newShape]);
    setSelectedShapeIndex(prev => prev === null ? 0 : prev + 1);
    setSelectedTextIndex(null);
  };
  const handleShapeChange = (index, key, value) => {
    setSetupShapes(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], [key]: value };
      }
      return updated;
    });
  };

  const handleRemoveShape = (index) => {
    setSetupShapes(prev => prev.filter((_, i) => i !== index));
    if (selectedShapeIndex === index) {
      setSelectedShapeIndex(null);
    }
  };

  const handleShapeDragStart = (e, index) => {
      e.stopPropagation();
      setSelectedShapeIndex(index);
      setSelectedTextIndex(null);

      const img = templateImageRef.current;
      const rect = img.getBoundingClientRect();
      const scaleX = setupTemplateDims.width / rect.width;
      const scaleY = setupTemplateDims.height / rect.height;

      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      const shape = setupShapes[index];
      const offsetX = shape.x - mouseX;
      const offsetY = shape.y - mouseY;

      shapeDragRef.current = { isDragging: true, index, offsetX, offsetY };

      const handleShapeDragMove = (moveEvent) => {
          if (!shapeDragRef.current.isDragging) return;

          const newMouseX = (moveEvent.clientX - rect.left) * scaleX;
          const newMouseY = (moveEvent.clientY - rect.top) * scaleY;

          let newX = newMouseX + shapeDragRef.current.offsetX;
          let newY = newMouseY + shapeDragRef.current.offsetY;

          // TODO: Add snapping for shapes similar to text

          setSetupShapes(prev => {
              const updated = [...prev];
              if (updated[index]) {
                  updated[index] = { ...updated[index], x: newX, y: newY };
              }
              return updated;
          });
      };

      const handleShapeDragEnd = () => {
          shapeDragRef.current.isDragging = false;
          window.removeEventListener('mousemove', handleShapeDragMove);
          window.removeEventListener('mouseup', handleShapeDragEnd);
      };

      window.addEventListener('mousemove', handleShapeDragMove);
      window.addEventListener('mouseup', handleShapeDragEnd);
  };

  const handleTransformStart = (e, itemType, index, transformType, handle = null) => {
      e.stopPropagation();
      e.preventDefault();

      const item = itemType === 'text' ? setupTexts[index] : setupShapes[index];
      const itemElem = document.getElementById(`${itemType}-${item.id}`);
      if (!itemElem) return;

      const itemRect = itemElem.getBoundingClientRect();
      const centerX = itemRect.left + itemRect.width / 2;
      const centerY = itemRect.top + itemRect.height / 2;

      transformRef.current = {
          isTransforming: true, type: transformType, itemType, index, handle,
          startX: e.clientX, startY: e.clientY,
          startW: item.width, startH: item.height,
          startXPos: item.x, startYPos: item.y,
          startRotation: item.rotation || 0,
          centerX, centerY
      };

      const handleTransformMove = (moveEvent) => {
          if (!transformRef.current.isTransforming) return;

          const { type, itemType, index, handle, startX, startY, startW, startH, startXPos, startYPos, startRotation, centerX, centerY } = transformRef.current;
          const updateFunc = itemType === 'text' ? setSetupTexts : setSetupShapes;

          if (type === 'rotate') {
              const currentX = moveEvent.clientX;
              const currentY = moveEvent.clientY;
              const startAngle = Math.atan2(startY - centerY, startX - centerX) * (180 / Math.PI);
              const currentAngle = Math.atan2(currentY - centerY, currentX - centerX) * (180 / Math.PI);
              let newRotation = Math.round(startRotation + (currentAngle - startAngle));
              
              updateFunc(prev => {
                  const updated = [...prev];
                  if (updated[index]) {
                      updated[index] = { ...updated[index], rotation: newRotation };
                  }
                  return updated;
              });

          } else if (type === 'resize') {
              const img = templateImageRef.current;
              if (!img) return;
              const rect = img.getBoundingClientRect();
              const scaleX = setupTemplateDims.width / rect.width;
              const scaleY = setupTemplateDims.height / rect.height;

              const dx = (moveEvent.clientX - startX) * scaleX;
              const dy = (moveEvent.clientY - startY) * scaleY;

              let newWidth = startW, newHeight = startH, newX = startXPos, newY = startYPos;

              if (handle.includes('right')) newWidth = Math.max(20, startW + dx);
              if (handle.includes('left')) {
                  newWidth = Math.max(20, startW - dx);
                  newX = startXPos + dx;
              }
              if (handle.includes('bottom')) newHeight = Math.max(20, startH + dy);
              if (handle.includes('top')) {
                  newHeight = Math.max(20, startH - dy);
                  newY = startYPos + dy;
              }

              updateFunc(prev => {
                  const updated = [...prev];
                  if (updated[index]) {
                      updated[index] = {
                          ...updated[index],
                          width: newWidth, height: newHeight,
                          x: newX, y: newY
                      };
                  }
                  return updated;
              });
          }
      };

      const handleTransformEnd = () => {
          transformRef.current.isTransforming = false;
          window.removeEventListener('mousemove', handleTransformMove);
          window.removeEventListener('mouseup', handleTransformEnd);
          window.removeEventListener('touchmove', handleTransformMove);
          window.removeEventListener('touchend', handleTransformEnd);
      };

      window.addEventListener('mousemove', handleTransformMove);
      window.addEventListener('mouseup', handleTransformEnd);
      window.addEventListener('touchmove', handleTransformMove);
      window.addEventListener('touchend', handleTransformEnd);
  };






  if (isPasswordRecovery) {
    return <UpdatePassword />;
  }

  if (!session) {
    return <Auth />;
  }

  // --- Main Render ---
  return (
    
    <div className="dashboard">
      <datalist id="font-size-list">
        {WORD_SIZES.map(s => <option key={s} value={s} />)}
      </datalist>
      
      <style>{`
        /* --- Full Window Layout Styles --- */
        html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        .no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spin { -moz-appearance: textfield; }
        .dashboard { display: flex; flex-direction: column; width: 100vw; height: 100vh; max-width: 1440px; margin: 0 auto; overflow: hidden; box-sizing: border-box; }
        .header { flex-shrink: 0; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); }
        .header h1 { margin: 0; font-size: 1.5rem; }
        .header-actions { display: flex; gap: 15px; align-items: center; }
        .main-content { flex: 1; display: flex; flex-direction: row; gap: 20px; padding: 10px 20px 20px 20px; height: 100%; box-sizing: border-box; overflow: hidden; }
        .main-content.setup-layout { flex-direction: column; overflow-y: auto; padding: 10px 20px; align-items: center; justify-content: flex-start; }
        .main-content.setup-layout.in-editor { padding: 0; overflow: hidden; align-items: stretch; justify-content: stretch; }
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
        .setup-container.editing-mode { width: 100%; height: 100%; max-width: none; display: flex; flex-direction: row; gap: 0; padding: 0; margin: 0; }
        .editing-sidebar { width: 380px; background: var(--item-bg); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; overflow-y: auto; padding: 20px; box-shadow: 2px 0 10px rgba(0,0,0,0.1); z-index: 10; flex-shrink: 0; }
        .editing-workspace { flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; background: var(--bg-main); }
        .workspace-toolbar { height: 50px; background: var(--item-bg); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; gap: 15px; padding: 0 20px; z-index: 10; flex-shrink: 0; }
        .workspace-canvas { flex: 1; overflow: auto; padding: 40px; display: flex; align-items: flex-start; justify-content: center; }
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
          flex-shrink: 0;
          padding-top: 15px;
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
        }
        .template-management-card .upload-container h3 { font-size: 1rem; margin: 0; }

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
        <div 
          onClick={() => {
            const newClicks = headerClicks + 1;
            setHeaderClicks(newClicks);
            if (newClicks >= 5) {
              setIsDeveloperMode(!isDeveloperMode);
              setHeaderClicks(0);
            }
          }}
          style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '15px' }}
          title={isDeveloperMode ? "Developer Mode is Active. Click 5 times to disable." : ""}
        >
          <img src={photoboothLogo} alt="Photo Booth Logo" className="header-logo" />
          {isDeveloperMode && <span style={{ fontSize: '0.8rem', color: 'red', verticalAlign: 'middle' }}>(DEV MODE)</span>}
        </div>
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
          <button onClick={() => supabase.auth.signOut()} className="secondary-btn" style={{padding: '4px 10px', marginLeft: '10px'}}>
            Logout
          </button>
        </div>
      </header>

      {mode === 'live' ? (
        isPreviewMode ? (
          // --- Final Preview and Action Step ---
          <main className="main-content">
            <div className="preview-container" ref={previewContainerRef}>
              <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>Final Preview (Drag photos to adjust)</h2>
              <div className="photo-review-wrapper" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0, padding: '10px' }}>
                  <div className="photo-review" style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', borderRadius: '8px' }}>
                  <img 
                    src={getAssetUrl('template', activeTemplate)} 
                    alt="Final merged card"
                    className="template-bg"
                    style={{ width: '100%', height: '100%', display: 'block', position: 'relative', zIndex: 30, pointerEvents: 'none' }}
                  onLoad={(e) => {
                     const img = e.target;
                     if (img.parentElement) {
                         img.parentElement.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
                     }
                     setTemplateDims({ width: img.naturalWidth || 1000, height: img.naturalHeight || 1000 });
                     setTimeout(() => {
                         setTemplateScale(img.getBoundingClientRect().width / img.naturalWidth);
                     }, 10);
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
                           left: `${(area.x / templateDims.width) * 100}%`,
                           top: `${(area.y / templateDims.height) * 100}%`,
                           width: `${(area.width / templateDims.width) * 100}%`,
                           height: `${(area.height / templateDims.height) * 100}%`,
                           overflow: 'hidden',
                           zIndex: 20,
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
                {(() => {
                   const texts = activeTemplateConfig.texts || [];
                   return texts.map((t, idx) => {
                       const styles = getTextStyleOptions(t, templateScale);
                       return (
                       <div key={`text-${idx}`} style={{
                            position: 'absolute',
                            left: `${(t.x / templateDims.width) * 100}%`,
                            top: `${(t.y / templateDims.height) * 100}%`,
                            transform: t.textAlign === 'left' ? 'translate(0%, -50%)' : t.textAlign === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)',
                            textAlign: t.textAlign || 'center',
                            fontSize: `${(t.fontSize || 50) * templateScale}px`,
                            letterSpacing: `${(t.letterSpacing || 0) * templateScale}px`,
                            lineHeight: t.lineHeight || 1.2,
                            fontFamily: t.fontFamily || 'Arial',
                            color: styles.color,
                            fontWeight: styles.fontWeight,
                            fontStyle: styles.fontStyle,
                            textDecoration: styles.textDecoration,
                            textShadow: styles.textShadow,
                            WebkitTextStroke: styles.WebkitTextStroke,
                            WebkitTextFillColor: styles.WebkitTextFillColor,
                            backgroundImage: styles.backgroundImage,
                            backgroundColor: styles.backgroundColor,
                            WebkitBackgroundClip: styles.WebkitBackgroundClip,
                            backgroundClip: styles.backgroundClip,
                            padding: styles.padding,
                            opacity: styles.opacity,
                            borderRadius: styles.borderRadius,
                            pointerEvents: 'none',
                            zIndex: 40 + idx,
                            whiteSpace: 'pre-wrap',
                       }}>
                           {getDisplayText(t)}
                       </div>
                   )});
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
                <select id="template-select" value={activeTemplate} onChange={(e) => setActiveTemplate(e.target.value)} disabled={availableTemplatesForLive.length === 0 || isProcessing}>
                  {availableTemplatesForLive.length > 0 ? availableTemplatesForLive.map(t => <option key={t} value={t}>{t}</option>) : <option>No templates enabled</option>}
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
                        style={{ display: 'block', position: 'relative', height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain', zIndex: 30, pointerEvents: 'none' }}
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
                              padding: 0,
                              zIndex: 20
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
                      {(() => {
                         const texts = activeTemplateConfig.texts || [];
                         return texts.map((t, idx) => {
                             const styles = getTextStyleOptions(t, livePreviewScale);
                             return (
                             <div key={`live-text-${idx}`} style={{
                                  position: 'absolute',
                                  left: `${(t.x / livePreviewDims.width) * 100}%`,
                                  top: `${(t.y / livePreviewDims.height) * 100}%`,
                                  transform: t.textAlign === 'left' ? 'translate(0%, -50%)' : t.textAlign === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)',
                                  textAlign: t.textAlign || 'center',
                                  fontSize: `${(t.fontSize || 50) * livePreviewScale}px`,
                                  letterSpacing: `${(t.letterSpacing || 0) * livePreviewScale}px`,
                                  lineHeight: t.lineHeight || 1.2,
                                  fontFamily: t.fontFamily || 'Arial',
                                  color: styles.color,
                                  fontWeight: styles.fontWeight,
                                  fontStyle: styles.fontStyle,
                                  textDecoration: styles.textDecoration,
                                  textShadow: styles.textShadow,
                                  WebkitTextStroke: styles.WebkitTextStroke,
                                  WebkitTextFillColor: styles.WebkitTextFillColor,
                                  backgroundImage: styles.backgroundImage,
                                  backgroundColor: styles.backgroundColor,
                                  WebkitBackgroundClip: styles.WebkitBackgroundClip,
                                  backgroundClip: styles.backgroundClip,
                                  padding: styles.padding,
                                  opacity: styles.opacity,
                                  borderRadius: styles.borderRadius,
                                  pointerEvents: 'none',
                                  zIndex: 40 + idx,
                                  whiteSpace: 'pre-wrap',
                             }}>
                                 {getDisplayText(t)}
                             </div>
                         )});
                      })()}
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
        <main className={`main-content setup-layout ${selectedTemplateForEditing ? 'in-editor' : ''}`}>
          <div className={`setup-container ${selectedTemplateForEditing ? 'editing-mode' : 'list-mode'}`}>
            {selectedTemplateForEditing ? (
              <React.Fragment>
                <div className="editing-sidebar">
                  <h2>Editing: {selectedTemplateForEditing}</h2>
                  <button 
                    onClick={() => {
                        if (JSON.stringify(appConfig[selectedTemplateForEditing]?.texts || []) !== JSON.stringify(setupTexts) || JSON.stringify(appConfig[selectedTemplateForEditing]?.shapes || []) !== JSON.stringify(setupShapes)) {
                            if (window.confirm("You have unsaved changes. Are you sure you want to leave without saving?")) {
                                setSelectedTemplateForEditing(null);
                            }
                        } else {
                            setSelectedTemplateForEditing(null);
                        }
                    }} 
                    className="back-arrow-btn" style={{position: 'absolute', top: '20px', right: '20px', width: '36px', height: '36px'}}>⬅</button>                  {isDefaultTemplate ? (
                      isDeveloperMode ? (
                          <p style={{ color: 'var(--accent-pink)', fontSize: '0.9rem' }}>🔓 Developer Mode: You can now edit areas.</p>
                      ) : (
                          <p style={{ color: 'var(--accent-pink)', fontSize: '0.9rem' }}>🔒 Default Template. Image areas locked.</p>
                      )
                  ) : (
                      <p style={{ fontSize: '0.9rem' }}>Draw up to 4 rectangles on the template where the guest's photos should appear (in order).</p>
                  )}
                  
                  <div className="actions" style={{ flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                    {!isDrawingLocked && <button onClick={handleClearBoxes} className="secondary-btn" type="button" style={{ width: '100%' }}>Clear Areas</button>}
                  </div>
  
                  <div className="config-section" style={{ marginTop: '20px', padding: 0, boxShadow: 'none', background: 'transparent' }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '15px'}}>
                          <div style={{display:'flex', gap:'5px', background:'var(--input-bg)', padding:'4px', borderRadius:'8px'}}>
                              <button onClick={()=>setActiveEditorTab('shapes')} className={activeEditorTab==='shapes'?'approve-btn':'secondary-btn'} style={{padding:'4px 10px', fontSize:'0.85rem'}}>Shapes</button>
                              <button onClick={()=>setActiveEditorTab('format')} className={activeEditorTab==='format'?'approve-btn':'secondary-btn'} style={{padding:'4px 10px', fontSize:'0.85rem'}}>Format</button>
                              <button onClick={()=>setActiveEditorTab('effects')} className={activeEditorTab==='effects'?'approve-btn':'secondary-btn'} style={{padding:'4px 10px', fontSize:'0.85rem'}}>Effects</button>
                          </div>
                          <button onClick={handleAddText} className="secondary-btn" type="button" title="Add a new text element" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                              + Add Text
                          </button>
                      </div>
                      
                      {activeEditorTab === 'shapes' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }} >
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                <button onClick={() => handleAddShape('rect')} className="secondary-btn" style={{aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button>
                                <button onClick={() => handleAddShape('ellipse')} className="secondary-btn" style={{aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button>
                                <button onClick={() => handleAddShape('triangle')} className="secondary-btn" style={{aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="24" height="24" viewBox="0 0 24 24"><polygon points="12,2 22,22 2,22" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button>
                                <button onClick={() => handleAddShape('star')} className="secondary-btn" style={{aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="24" height="24" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button>
                                <button onClick={() => handleAddShape('arrow')} className="secondary-btn" style={{aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                                <button onClick={() => handleAddShape('heart')} className="secondary-btn" style={{aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="24" height="24" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button>
                            </div>
                            {selectedShapeIndex !== null && setupShapes[selectedShapeIndex] && (() => {
                                const shape = setupShapes[selectedShapeIndex];
                                const i = selectedShapeIndex;
                                return (
                                    <div style={{ border: '1px solid var(--border-color)', padding: '15px', borderRadius: '8px', background: 'var(--item-bg)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '0.9rem', color: 'var(--accent-pink)' }}>Selected Shape</strong>
                                            <button onClick={() => handleRemoveShape(i)} title="Delete Shape" style={{ background: 'var(--btn-danger)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                                        </div>
                                        <div className="control-group" style={{alignItems: 'center', margin: 0, flexDirection: 'row', gap: '10px'}}>
                                            <label style={{fontSize: '0.8rem'}}>Fill Color</label>
                                            <input type="color" value={shape.fill === 'transparent' ? '#ffffff' : shape.fill} onChange={(e) => handleShapeChange(i, 'fill', e.target.value)} style={{height: '30px', flex: 1}} disabled={shape.fill === 'transparent'} />
                                            <button onClick={() => handleShapeChange(i, 'fill', shape.fill === 'transparent' ? '#ff9a9e80' : 'transparent')} className="secondary-btn" style={{padding: '4px 8px', fontSize: '0.75rem'}}>{shape.fill === 'transparent' ? 'Add Fill' : 'No Fill'}</button>
                                        </div>
                                        <div className="control-group" style={{alignItems: 'center', margin: 0, flexDirection: 'row', gap: '10px'}}><label style={{fontSize: '0.8rem'}}>Outline</label><input type="color" value={shape.stroke} onChange={(e) => handleShapeChange(i, 'stroke', e.target.value)} style={{height: '30px', flex: 1}} /></div>
                                        <div className="control-group" style={{alignItems: 'flex-start', margin: 0}}>
                                            <label style={{fontSize: '0.8rem'}}>Outline Width</label>
                                            <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
                                                <input type="range" min="0" max="50" step="1" value={shape.strokeWidth} onChange={(e) => handleShapeChange(i, 'strokeWidth', parseInt(e.target.value))} style={{flex: 1}} />
                                                <span>{shape.strokeWidth}px</span>
                                            </div>
                                        </div>
                                        <div className="control-group" style={{alignItems: 'flex-start', margin: 0}}>
                                            <label style={{fontSize: '0.8rem'}}>Rotation</label>
                                            <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
                                                <input type="range" min="-180" max="180" step="1" value={shape.rotation || 0} onChange={(e) => handleShapeChange(i, 'rotation', parseInt(e.target.value))} style={{flex: 1}} />
                                                <input type="number" value={shape.rotation || 0} onChange={(e) => handleShapeChange(i, 'rotation', parseInt(e.target.value))} style={{width: '60px', textAlign: 'center', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)'}} />
                                                <span>°</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            {(selectedShapeIndex === null) && (
                                <div style={{ textAlign: 'center', padding: '20px', background: 'var(--item-bg)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Add a new shape or select one on the template to edit it.</p>
                                </div>
                            )}
                        </div>
                      )}
                      {activeEditorTab !== 'shapes' && selectedTextIndex !== null && setupTexts[selectedTextIndex] ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                              {(() => {
                                  const t = setupTexts[selectedTextIndex];
                                  const i = selectedTextIndex;
                                  const effs = t.effects || {};
                                  return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-color)', padding: '15px', borderRadius: '8px', background: 'var(--item-bg)' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <strong style={{ fontSize: '0.9rem', color: 'var(--accent-pink)' }}>Selected Text</strong>
                                              <button onClick={() => handleRemoveText(i)} title="Delete Text" style={{ background: 'var(--btn-danger)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                                          </div>
                                          
                                          <div className="control-group" style={{alignItems: 'flex-start', margin: 0}}><label style={{fontSize: '0.8rem'}}>Content (Double-click text on image to edit inline)</label><textarea value={t.text} onChange={(e) => handleTextChange(i, 'text', e.target.value)} rows="3" style={{padding: '6px', fontSize: '0.9rem', width: '100%', resize: 'vertical', fontFamily: 'inherit', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', textAlign: t.textAlign || 'center'}}/></div>
                                          
                                          {activeEditorTab === 'format' && (
                                            <>
                                          <div className="control-group" style={{alignItems: 'flex-start', margin: 0, minWidth: 0}}>
                                              <label style={{fontSize: '0.8rem'}}>Font Family</label>
                                              <select value={t.fontFamily} onChange={(e) => handleTextChange(i, 'fontFamily', e.target.value)} style={{padding: '6px', fontSize: '0.9rem', width: '100%', minWidth: 0, fontFamily: t.fontFamily}}>
                                                  {FONT_OPTIONS.map(font => <option key={font} value={font} style={{ fontFamily: font, fontSize: '1.1rem' }}>{font}</option>)}
                                              </select>
                                          </div>
                                          
                                          <div className="control-group" style={{alignItems: 'flex-start', margin: 0, minWidth: 0}}>
                                              <label style={{fontSize: '0.8rem'}}>Font Styling</label>
                                              <div style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap', alignItems: 'center' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                                                      <button onClick={() => handleTextChange(i, 'fontSize', (parseInt(t.fontSize)||50) - 1)} className="secondary-btn" style={{ padding: '4px 8px', border: 'none', borderRadius: 0 }}>-</button>
                                                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                                                          <input type="number" className="no-spin" value={t.fontSize} onChange={(e) => handleTextChange(i, 'fontSize', e.target.value)} style={{ width: '50px', padding: '4px 20px 4px 4px', fontSize: '0.9rem', textAlign: 'center', border: 'none', background: 'transparent', color: 'var(--text-main)' }} />
                                                          <select value={t.fontSize} onChange={(e) => handleTextChange(i, 'fontSize', e.target.value)} style={{ position: 'absolute', right: 0, top: 0, width: '20px', height: '100%', opacity: 0, cursor: 'pointer' }}>
                                                              {WORD_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                                              {!WORD_SIZES.includes(parseInt(t.fontSize)) && <option value={t.fontSize}>{t.fontSize}</option>}
                                                          </select>
                                                          <div style={{ position: 'absolute', right: '4px', pointerEvents: 'none', fontSize: '0.6rem', color: 'var(--text-muted)' }}>▼</div>
                                                      </div>
                                                      <button onClick={() => handleTextChange(i, 'fontSize', (parseInt(t.fontSize)||50) + 1)} className="secondary-btn" style={{ padding: '4px 8px', border: 'none', borderRadius: 0 }}>+</button>
                                                  </div>
                                                  
                                                  <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>
                                                  
                                                  <div style={{ display: 'flex', gap: '2px' }}>
                                                      <button onClick={() => handleTextChange(i, 'fontWeight', t.fontWeight === 'normal' ? 'bold' : 'normal')} className={t.fontWeight === 'normal' ? 'secondary-btn' : 'approve-btn'} style={{fontWeight: 'bold', width: '32px', padding: '4px'}} title="Bold">B</button>
                                                      <button onClick={() => handleTextChange(i, 'fontStyle', t.fontStyle === 'italic' ? 'normal' : 'italic')} className={t.fontStyle === 'italic' ? 'approve-btn' : 'secondary-btn'} style={{fontStyle: 'italic', width: '32px', padding: '4px'}} title="Italic">I</button>
                                                      <button onClick={() => handleTextChange(i, 'textDecoration', t.textDecoration === 'underline' ? 'none' : 'underline')} className={t.textDecoration === 'underline' ? 'approve-btn' : 'secondary-btn'} style={{textDecoration: 'underline', width: '32px', padding: '4px'}} title="Underline">U</button>
                                                  </div>
                                              </div>
                                          </div>
                                          
                                          <div className="control-group" style={{alignItems: 'flex-start', margin: 0, minWidth: 0, gridColumn: '1 / -1'}}>
                                              <label style={{fontSize: '0.8rem'}}>Alignment & List</label>
                                              <div style={{ display: 'flex', gap: '15px', width: '100%', flexWrap: 'wrap', alignItems: 'center' }}>
                                                  <div style={{ display: 'flex', gap: '2px' }}>
                                                      <button onClick={() => handleTextAlignChange(i, 'left')} className={t.textAlign === 'left' ? 'approve-btn' : 'secondary-btn'} style={{padding: '4px 8px', display: 'flex', alignItems: 'center'}} title="Align Left">
                                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="2"/><rect x="2" y="7" width="8" height="2"/><rect x="2" y="11" width="12" height="2"/></svg>
                                                      </button>
                                                      <button onClick={() => handleTextAlignChange(i, 'center')} className={!t.textAlign || t.textAlign === 'center' ? 'approve-btn' : 'secondary-btn'} style={{padding: '4px 8px', display: 'flex', alignItems: 'center'}} title="Align Center">
                                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="2"/><rect x="4" y="7" width="8" height="2"/><rect x="2" y="11" width="12" height="2"/></svg>
                                                      </button>
                                                      <button onClick={() => handleTextAlignChange(i, 'right')} className={t.textAlign === 'right' ? 'approve-btn' : 'secondary-btn'} style={{padding: '4px 8px', display: 'flex', alignItems: 'center'}} title="Align Right">
                                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="2"/><rect x="6" y="7" width="8" height="2"/><rect x="2" y="11" width="12" height="2"/></svg>
                                                      </button>
                                                  </div>
                                                  
                                                  <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>
                                                  
                                                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                                                      <span style={{ padding: '0 8px', fontSize: '1.2rem', color: 'var(--text-muted)' }}>☷</span>
                                                      <select value={t.listType || 'none'} onChange={(e) => handleTextChange(i, 'listType', e.target.value)} style={{ padding: '4px 8px', minWidth: '80px', border: 'none', borderLeft: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)'}}>
                                                          <option value="none">⃠</option>
                                                          <option value="bullet">•&emsp;Aaa</option>
                                                          <option value="number">1.&emsp;Aaa</option>
                                                          <option value="roman_upper">I.&emsp;Aaa</option>
                                                          <option value="roman_lower">i.&emsp;Aaa</option>
                                                          <option value="circle">◦&emsp;Aaa</option>
                                                          <option value="square">■&emsp;Aaa</option>
                                                          <option value="star">★&emsp;Aaa</option>
                                                      </select>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="control-group" style={{alignItems: 'flex-start', margin: 0, minWidth: 0}}>
                                              <label style={{fontSize: '0.8rem'}}>Rotation</label>
                                              <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
                                                  <input type="range" min="-180" max="180" step="1" value={t.rotation || 0} onChange={(e) => handleTextChange(i, 'rotation', parseInt(e.target.value))} style={{flex: 1}} />
                                                  <input type="number" value={t.rotation || 0} onChange={(e) => handleTextChange(i, 'rotation', parseInt(e.target.value))} style={{width: '60px', textAlign: 'center', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)'}} />
                                                  <span>°</span>
                                              </div>
                                          </div>

                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                              <div className="control-group" style={{alignItems: 'flex-start', margin: 0, minWidth: 0}}>
                                                  <label style={{fontSize: '0.8rem'}}>Letter Spacing</label>
                                                  <div style={{ display: 'flex', gap: '5px', width: '100%', minWidth: 0, alignItems: 'center' }}>
                                                      <input type="range" min="-10" max="100" step="1" value={t.letterSpacing || 0} onChange={(e) => handleTextChange(i, 'letterSpacing', e.target.value)} style={{flex: 1, cursor: 'pointer'}} />
                                                      <span style={{ fontSize: '0.8rem', width: '25px', textAlign: 'right' }}>{t.letterSpacing || 0}</span>
                                                  </div>
                                              </div>
                                              <div className="control-group" style={{alignItems: 'flex-start', margin: 0, minWidth: 0}}>
                                                  <label style={{fontSize: '0.8rem'}}>Line Spacing</label>
                                                  <div style={{ display: 'flex', gap: '5px', width: '100%', minWidth: 0, alignItems: 'center' }}>
                                                      <input type="range" min="0.5" max="3" step="0.1" value={t.lineHeight || 1.2} onChange={(e) => handleTextChange(i, 'lineHeight', e.target.value)} style={{flex: 1, cursor: 'pointer'}} />
                                                      <span style={{ fontSize: '0.8rem', width: '25px', textAlign: 'right' }}>{t.lineHeight || 1.2}</span>
                                                  </div>
                                              </div>
                                          </div>

                                          <div className="control-group" style={{alignItems: 'flex-start', margin: 0, minWidth: 0}}>
                                              <label style={{fontSize: '0.8rem'}}>Opacity</label>
                                              <div style={{ display: 'flex', gap: '5px', width: '100%', minWidth: 0, alignItems: 'center' }}>
                                                  <input type="range" min="0" max="1" step="0.05" value={t.opacity ?? 1} onChange={(e) => handleTextChange(i, 'opacity', e.target.value)} style={{flex: 1, cursor: 'pointer'}} />
                                                  <span style={{ fontSize: '0.8rem', width: '35px', textAlign: 'right' }}>{Math.round((t.opacity ?? 1) * 100)}%</span>
                                              </div>
                                          </div>

                                          {/* Colors Section */}
                                          <div className="control-group" style={{alignItems: 'flex-start', margin: 0, minWidth: 0, width: '100%'}}>
                                              <div style={{display:'flex', justifyContent:'space-between', width:'100%', alignItems: 'center', marginBottom: '5px'}}>
                                                  <label style={{fontSize: '0.8rem', margin: 0}}>Color & Fill</label>
                                                  <select value={t.fillType||'solid'} onChange={(e)=>handleTextChange(i, 'fillType', e.target.value)} style={{padding:'2px 5px', fontSize:'0.75rem', width:'auto', minWidth: '80px'}}>
                                                      <option value="solid">Solid</option>
                                                      <option value="gradient">Gradient</option>
                                                  </select>
                                              </div>
                                              
                                              {t.fillType === 'gradient' ? (
                                                  <div style={{display:'flex', gap:'10px', width:'100%', alignItems:'center', background:'var(--input-bg)', padding:'8px', borderRadius:'8px', boxSizing: 'border-box'}}>
                                                      <input type="color" value={t.color || '#000000'} onChange={(e) => handleTextChange(i, 'color', e.target.value)} style={{height: '30px', width: '30px', cursor: 'pointer', padding: 0, border: 'none', flexShrink: 0}} />
                                                      <input type="color" value={t.color2 || '#ffffff'} onChange={(e) => handleTextChange(i, 'color2', e.target.value)} style={{height: '30px', width: '30px', cursor: 'pointer', padding: 0, border: 'none', flexShrink: 0}} />
                                                      <div style={{flex: 1, display:'flex', flexDirection:'column', minWidth: 0}}>
                                                          <span style={{fontSize:'0.7rem'}}>Angle: {t.gradientAngle||90}°</span>
                                                          <input type="range" min="0" max="360" value={t.gradientAngle||90} onChange={(e) => handleTextChange(i, 'gradientAngle', e.target.value)} style={{width:'100%'}}/>
                                                      </div>
                                                  </div>
                                              ) : (
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', background: 'var(--input-bg)', padding: '8px', borderRadius: '8px', boxSizing: 'border-box' }}>
                                                      <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                                                          <input type="color" value={t.color || '#000000'} onChange={(e) => handleTextChange(i, 'color', e.target.value)} style={{height: '30px', padding: '1px', width: '35px', cursor: 'pointer', flexShrink: 0}} />
                                                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                                                              {DEFAULT_COLORS.map(c => (
                                                                  <div key={c} onClick={() => handleTextChange(i, 'color', c)} style={{ width: '18px', height: '18px', backgroundColor: c, cursor: 'pointer', border: t.color === c ? '2px solid var(--btn-primary)' : '1px solid var(--border-color)', borderRadius: '4px' }} title={c} />
                                                              ))}
                                                          </div>
                                                      </div>
                                                      {templateColors.length > 0 && (
                                                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: '100%', alignItems: 'center', marginTop: '4px' }}>
                                                              <span style={{fontSize: '0.7rem', width: '35px', flexShrink: 0}}>Photo:</span>
                                                              {templateColors.map(c => (
                                                                  <div key={c} onClick={() => handleTextChange(i, 'color', c)} style={{ width: '16px', height: '16px', backgroundColor: c, cursor: 'pointer', border: t.color === c ? '2px solid var(--btn-primary)' : '1px solid var(--border-color)', borderRadius: '50%' }} title={`Template Color: ${c}`} />
                                                              ))}
                                                          </div>
                                                      )}
                                                  </div>
                                              )}
                                              {/* Default Gradients Shortcuts */}
                                              {t.fillType === 'gradient' && (
                                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: '100%', marginTop: '8px' }}>
                                                      {DEFAULT_GRADIENTS.map((g, gi) => (
                                                          <div key={gi} onClick={() => { handleTextChange(i, 'color', g.c1); handleTextChange(i, 'color2', g.c2); }} style={{ width: '22px', height: '22px', background: `linear-gradient(135deg, ${g.c1}, ${g.c2})`, cursor: 'pointer', border: '1px solid var(--border-color)', borderRadius: '4px' }} title="Apply Gradient" />
                                                      ))}
                                                  </div>
                                              )}
                                          </div>

                                          <div className="control-group" style={{alignItems: 'flex-start', margin: 0, minWidth: 0, gridColumn: '1 / -1'}}>
                                              <label style={{fontSize: '0.8rem'}}>Layer Arrangement</label>
                                              <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
                                                  <button onClick={() => handleLayerChange(i, 'back')} className="secondary-btn" style={{flex: 1, padding: '4px', fontSize: '0.8rem'}}>⇊ Back</button>
                                                  <button onClick={() => handleLayerChange(i, 'backward')} className="secondary-btn" style={{flex: 1, padding: '4px', fontSize: '0.8rem'}}>↓ Backwd</button>
                                                  <button onClick={() => handleLayerChange(i, 'forward')} className="secondary-btn" style={{flex: 1, padding: '4px', fontSize: '0.8rem'}}>↑ Forwd</button>
                                                  <button onClick={() => handleLayerChange(i, 'front')} className="secondary-btn" style={{flex: 1, padding: '4px', fontSize: '0.8rem'}}>⇈ Front</button>
                                              </div>
                                          </div>
                                          </>
                                          )}

                                          {/* --- Effects Tab --- */}
                                          {activeEditorTab === 'effects' && (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                                      {[
                                                          { id: 'drop', name: 'Shadow', style: { textShadow: '2px 2px 0px #888' } },
                                                          { id: 'glow', name: 'Glow', style: { textShadow: '0 0 5px #ff5555' } },
                                                          { id: 'echo', name: 'Echo', style: { textShadow: '2px 2px 0px #aaa, 4px 4px 0px #555' } },
                                                          { id: 'outline', name: 'Outline', style: { WebkitTextStroke: '1px #555', WebkitTextFillColor: 'initial', color: 'transparent' } },
                                                          { id: 'hollow', name: 'Hollow', style: { WebkitTextStroke: '1px #888', WebkitTextFillColor: 'transparent', color: 'transparent' } },
                                                          { id: 'splice', name: 'Splice', style: { WebkitTextStroke: '1px #888', WebkitTextFillColor: 'transparent', textShadow: '3px 3px 0px #555', color: 'transparent' } },
                                                          { id: 'neon', name: 'Neon', style: { color: '#fff', textShadow: '0 0 5px #fff, 0 0 10px #f0f' } },
                                                          { id: 'glitch', name: 'Glitch', style: { textShadow: '1px 0 0 cyan, -1px 0 0 red' } },
                                                          { id: 'background', name: 'Bg', style: { background: '#ff0', padding: '2px 5px', borderRadius: '4px', color: '#000' } }
                                                      ].map(ef => (
                                                          <div 
                                                              key={ef.id} 
                                                              onClick={() => {
                                                                  handleEffectChange(i, ef.id, 'enabled', !effs[ef.id]?.enabled);
                                                                  if (expandedEffect === ef.id && effs[ef.id]?.enabled) {
                                                                      setExpandedEffect(null);
                                                                  } else {
                                                                      setExpandedEffect(ef.id);
                                                                  }
                                                              }}
                                                              style={{ 
                                                                  border: effs[ef.id]?.enabled ? '2px solid var(--btn-primary)' : '1px solid var(--border-color)', 
                                                                  borderRadius: '8px', padding: '10px 5px', cursor: 'pointer', textAlign: 'center', 
                                                                  background: effs[ef.id]?.enabled ? 'var(--btn-primary)' : 'var(--input-bg)',
                                                                  color: effs[ef.id]?.enabled ? '#ffffff' : 'var(--text-main)',
                                                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                                                                  transition: 'all 0.2s ease'
                                                              }}
                                                          >
                                                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', lineHeight: 1 }}><span style={{ ...(effs[ef.id]?.enabled ? {} : { filter: 'grayscale(1)', opacity: 0.7 }), ...ef.style }}>Aa</span></div>
                                                              <span style={{ fontSize: '0.7rem' }}>{ef.name}</span>
                                                          </div>
                                                      ))}
                                                  </div>
                                                  
                                                  {/* Specific Effect Settings based on expanded / enabled */}
                                                  {expandedEffect && effs[expandedEffect]?.enabled && (
                                                      <div style={{ background: 'var(--input-bg)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                          <div style={{display:'flex', justifyContent:'space-between', fontWeight:'bold', fontSize:'0.85rem'}}>
                                                              <span>{expandedEffect.toUpperCase()} Settings</span>
                                                              <button onClick={()=>setExpandedEffect(null)} style={{background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer'}}>x</button>
                                                          </div>
                                                          
                                                          {['drop', 'glow', 'echo', 'outline', 'splice', 'neon', 'background'].includes(expandedEffect) && (
                                                              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                                                  <label style={{fontSize:'0.8rem', width:'60px'}}>Color:</label>
                                                                  <input type="color" value={effs[expandedEffect]?.color ?? (expandedEffect==='glow'?'#ff0000':expandedEffect==='neon'?'#ff00ff':expandedEffect==='background'?'#ffff00':'#000000')} onChange={(e)=>handleEffectChange(i, expandedEffect, 'color', e.target.value)} style={{height:'30px', flex:1}} />
                                                              </div>
                                                          )}
                                                          {['drop', 'echo', 'splice'].includes(expandedEffect) && (
                                                              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                                                  <label style={{fontSize:'0.8rem', width:'60px'}}>Distance:</label>
                                                                  <input type="range" min="1" max="100" value={effs[expandedEffect]?.distance ?? 5} onChange={(e)=>handleEffectChange(i, expandedEffect, 'distance', parseInt(e.target.value))} style={{flex:1}} />
                                                              </div>
                                                          )}
                                                          {['drop', 'echo', 'splice'].includes(expandedEffect) && (
                                                              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                                                  <label style={{fontSize:'0.8rem', width:'60px'}}>Angle:</label>
                                                                  <input type="range" min="0" max="360" value={effs[expandedEffect]?.angle ?? 45} onChange={(e)=>handleEffectChange(i, expandedEffect, 'angle', parseInt(e.target.value))} style={{flex:1}} />
                                                              </div>
                                                          )}
                                                          {['glow'].includes(expandedEffect) && (
                                                              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                                                  <label style={{fontSize:'0.8rem', width:'60px'}}>Intensity:</label>
                                                                  <input type="range" min="1" max="100" value={effs[expandedEffect]?.intensity ?? 10} onChange={(e)=>handleEffectChange(i, expandedEffect, 'intensity', parseInt(e.target.value))} style={{flex:1}} />
                                                              </div>
                                                          )}
                                                          {['outline', 'hollow', 'splice'].includes(expandedEffect) && (
                                                              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                                                  <label style={{fontSize:'0.8rem', width:'60px'}}>Thickness:</label>
                                                                  <input type="range" min="1" max="20" value={effs[expandedEffect]?.thickness ?? 2} onChange={(e)=>handleEffectChange(i, expandedEffect, 'thickness', parseInt(e.target.value))} style={{flex:1}} />
                                                              </div>
                                                          )}
                                                      </div>
                                                  )}
                                              </div>
                                          )}

                                      </div>
                                  );
                              })()}
                          </div>
                      ) : activeEditorTab !== 'shapes' && (
                          <div style={{ textAlign: 'center', padding: '20px', background: 'var(--item-bg)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Select a text on the image to edit it, or click "+ Add Text".</p>
                          </div>
                      )}
                  </div>
                </div>
                 
                <div className="editing-workspace">
                  <div className="workspace-toolbar">
                    <div style={{flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Zoom:</label>
                            <input 
                                type="range" 
                                min="0.1" 
                                max="2" 
                                step="0.05" 
                                value={editorZoom} 
                                onChange={(e) => setEditorZoom(parseFloat(e.target.value))} 
                                style={{ width: '120px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.9rem', width: '40px', textAlign: 'right' }}>{Math.round(editorZoom * 100)}%</span>
                        </div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                            <input type="checkbox" id="grid-lines-toggle" checked={showGridLines} onChange={(e) => setShowGridLines(e.target.checked)} />
                            <label htmlFor="grid-lines-toggle" style={{fontSize: '0.8rem', userSelect: 'none', cursor: 'pointer'}}>Grid Lines</label>
                        </div>
                    </div>
                    <button onClick={handleSaveConfig} className="save-config-btn" style={{ padding: '4px 12px' }}>💾 Save</button>
                  </div>
                    <div className="workspace-canvas" onMouseMove={editorTool === 'draw' ? handleMouseMove : undefined} onMouseUp={editorTool === 'draw' ? handleMouseUp : undefined} onMouseLeave={editorTool === 'draw' ? handleMouseUp : undefined}>
                      <div 
                        style={{ 
                            position: 'relative', 
                            display: 'inline-block', 
                            width: `${setupTemplateDims.width * editorZoom}px`, 
                            height: `${setupTemplateDims.height * editorZoom}px`, 
                            textAlign: 'left', 
                            verticalAlign: 'top', 
                            overflow: 'visible' 
                        }} 
                        onMouseDown={(e) => { 
                            setSelectedTextIndex(null); 
                            setSelectedShapeIndex(null);
                            if (isDrawingAllowed) handleMouseDown(e); 
                        }}
                      >
                        {/* Grid lines and snap lines are now rendered on top */}
                        <div 
                            className="workspace-overlay" 
                            style={{ transform: `scale(${editorZoom})`, transformOrigin: 'top left' }}
                        >
                        </div>
                        <div style={{ position: 'relative', width: `${setupTemplateDims.width}px`, height: `${setupTemplateDims.height}px`, transform: `scale(${editorZoom})`, transformOrigin: 'top left' }}>
                          <img 
                            ref={templateImageRef} 
                            src={getAssetUrl('template', selectedTemplateForEditing)} 
                            alt="Template for setup" 
                            draggable="false"
                            onLoad={handleTemplateImageLoad}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', boxShadow: '0 8px 30px rgba(0,0,0,0.3)', borderRadius: '4px', maxWidth: 'none' }}
                          />
                          {selectionBoxes.map((box, idx) => (
                            <div key={idx} className="selection-box" style={{
                              left: `${(box.x / setupTemplateDims.width) * 100}%`,
                              top: `${(box.y / setupTemplateDims.height) * 100}%`,
                              width: `${(box.width / setupTemplateDims.width) * 100}%`,
                              height: `${(box.height / setupTemplateDims.height) * 100}%`,
                              cursor: editorTool === 'draw' ? 'default' : 'move'
                            }}>
                               <div className="box-index">{idx + 1}</div>
                            </div>
                          ))}
                          {currentBox && currentBox.width > 0 && (
                            <div className="selection-box" style={{
                              left: `${(currentBox.x / setupTemplateDims.width) * 100}%`,
                              top: `${(currentBox.y / setupTemplateDims.height) * 100}%`,
                              width: `${(currentBox.width / setupTemplateDims.width) * 100}%`,
                              height: `${(currentBox.height / setupTemplateDims.height) * 100}%`,
                            }} />
                          )}
                          {/* Render Shapes */}
                          {setupShapes.map((shape, idx) => {
                              const isSelected = selectedShapeIndex === idx;
                              const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'];
                              return (
                                <div 
                                    id={`shape-${shape.id}`}
                                    key={shape.id}
                                    style={{
                                        position: 'absolute',
                                        left: `${(shape.x / setupTemplateDims.width) * 100}%`,
                                        top: `${(shape.y / setupTemplateDims.height) * 100}%`, // This is correct
                                        width: `${(shape.width / setupTemplateDims.width) * 100}%`,
                                        height: `${(shape.height / setupTemplateDims.height) * 100}%`,
                                        transform: `translate(-50%, -50%) rotate(${shape.rotation || 0}deg)`,
                                        cursor: 'move',
                                        outline: isSelected ? '2px dashed var(--btn-primary)' : 'none',
                                        boxSizing: 'border-box',
                                        zIndex: 90 + idx
                                    }}
                                    onMouseDown={(e) => handleShapeDragStart(e, idx)}
                                >
                                {isSelected && (
                                    <div className="rotation-handle" onMouseDown={(e) => handleTransformStart(e, 'shape', idx, 'rotate')} onTouchStart={(e) => handleTransformStart(e, 'shape', idx, 'rotate')}></div>
                                )}
                                {shape.type === 'polygon' || shape.type === 'path' ? (
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                        {shape.type === 'polygon' && <polygon points={shape.points} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} vectorEffect="non-scaling-stroke" />}
                                        {shape.type === 'path' && <path d={shape.d} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth * 100 / Math.min(shape.width, shape.height)} vectorEffect="non-scaling-stroke" />}
                                    </svg>) : (
                                <div style={{
                                    width: '100%', height: '100%',
                                    background: shape.type === 'rect' ? shape.fill : 'transparent',
                                    borderRadius: shape.type === 'ellipse' ? '50%' : '0px',
                                    border: `${shape.strokeWidth}px solid ${shape.stroke}`
                                }} />
                                )}{isSelected && handles.map(handle => <div key={handle} className={`resize-handle ${handle}`} onMouseDown={(e) => handleTransformStart(e, 'shape', idx, 'resize', handle)} />)}
                                </div>
                              );
                          })}
                          {/* Draggable Text Previews */}
                          {setupTexts.map((text, idx) => {
                              const isSelected = selectedTextIndex === idx;
                              const styles = getTextStyleOptions(text, 1);
                              return (
                                <div key={`setup-text-wrapper-${idx}`}
                                    id={`text-${text.id}`} // Ensure text object has a unique id
                                    style={{
                                        position: 'absolute',
                                        left: `${(text.x / setupTemplateDims.width) * 100}%`,
                                        top: `${(text.y / setupTemplateDims.height) * 100}%`,
                                        width: text.width ? `${(text.width / setupTemplateDims.width) * 100}%` : 'auto',
                                        height: text.height ? `${(text.height / setupTemplateDims.height) * 100}%` : 'auto',
                                        transform: `translate(-50%, -50%) rotate(${text.rotation || 0}deg)`,
                                        cursor: 'move',
                                        outline: isSelected ? '2px dashed var(--btn-primary)' : 'none',
                                        zIndex: 100 + idx,
                                        userSelect: 'none',
                                    }}
                                    onMouseDown={(e) => handleTextDragStart(e, idx)}
                                    onContextMenu={(e) => handleTextContextMenu(e, idx)}
                                >
                                    {isSelected && (
                                        <div className="rotation-handle" onMouseDown={(e) => handleTransformStart(e, 'text', idx, 'rotate')} onTouchStart={(e) => handleTransformStart(e, 'text', idx, 'rotate')}></div>
                                    )}
                                    <div
                                        style={{
                                            width: '100%', height: '100%',
                                            textAlign: text.textAlign || 'center',
                                            fontSize: `${text.fontSize || 50}px`,
                                            letterSpacing: `${text.letterSpacing || 0}px`,
                                            lineHeight: text.lineHeight || 1.2,
                                            color: styles.color,
                                            fontWeight: styles.fontWeight,
                                            fontStyle: styles.fontStyle,
                                            textDecoration: styles.textDecoration,
                                            textShadow: styles.textShadow,
                                            WebkitTextStroke: styles.WebkitTextStroke,
                                            WebkitTextFillColor: styles.WebkitTextFillColor,
                                            backgroundImage: styles.backgroundImage,
                                            backgroundColor: styles.backgroundColor,
                                            WebkitBackgroundClip: styles.WebkitBackgroundClip,
                                            backgroundClip: styles.backgroundClip,
                                            padding: styles.padding,
                                            opacity: styles.opacity,
                                            borderRadius: styles.borderRadius,
                                            fontFamily: text.fontFamily || 'Arial',
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word',
                                        }}
                                        onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      e.target.contentEditable = true;
                                      e.target.focus();
                                      document.execCommand('selectAll', false, null);
                                      e.target.style.cursor = 'text';
                                  }}
                                  onBlur={(e) => {
                                      e.target.contentEditable = false;
                                      e.target.style.cursor = 'move';
                                      handleTextChange(idx, 'text', e.target.innerText || 'Text');
                                  }}
                                        suppressContentEditableWarning={true}
                                    >
                                        {getDisplayText(text)}
                                    </div>
                                    {isSelected && ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'right', 'left'].map(handle => <div key={handle} className={`resize-handle ${handle}`} onMouseDown={(e) => handleTransformStart(e, 'text', idx, 'resize', handle)} />)}
                                </div>
                              );
                          })}
                        </div>
                        {/* Overlay for Grid and Snap Lines */}
                        <svg className="workspace-overlay-svg" style={{ transform: `scale(${editorZoom})`, transformOrigin: 'top left' }}>
                            {/* Grid Lines */}
                            {showGridLines && isTextDragging && (
                                <g className="grid-lines-group">
                                    {/* Vertical Lines */}
                                    {Array.from({ length: 19 }).map((_, i) => <line key={`v-${i}`} x1={`${(i + 1) * 5}%`} y1="0" x2={`${(i + 1) * 5}%`} y2="100%" />)}
                                    {/* Horizontal Lines */}
                                    {Array.from({ length: 19 }).map((_, i) => <line key={`h-${i}`} x1="0" y1={`${(i + 1) * 5}%`} x2="100%" y2={`${(i + 1) * 5}%`} />)}
                                    {/* Center Lines */}
                                    <line className="center-line" x1="50%" y1="0" x2="50%" y2="100%" />
                                    <line className="center-line" x1="0" y1="50%" x2="100%" y2="50%" />
                                </g>
                            )}
                            {/* Snap Lines */}
                            {snapLines.map((line, i) => (
                                <line
                                    key={`snap-${i}`}
                                    className="snap-line"
                                    x1={line.type === 'vertical' ? line.position : 0}
                                    y1={line.type === 'horizontal' ? line.position : 0}
                                    x2={line.type === 'vertical' ? line.position : setupTemplateDims.width}
                                    y2={line.type === 'horizontal' ? line.position : setupTemplateDims.height}
                                />
                            ))}
                            {/* Distance Lines */}
                            {distanceLines.map((line, i) => (
                                <g key={`dist-${i}`} className="distance-line">
                                    <line x1={line.type === 'vertical' ? line.x : line.start} y1={line.type === 'vertical' ? line.start : line.y} x2={line.type === 'vertical' ? line.x : line.end} y2={line.type === 'vertical' ? line.end : line.y} />
                                    <line className="cap" x1={line.type === 'vertical' ? line.x - 5 : line.start} y1={line.type === 'vertical' ? line.start : line.y - 5} x2={line.type === 'vertical' ? line.x + 5 : line.start} y2={line.type === 'vertical' ? line.start : line.y + 5} />
                                    <line className="cap" x1={line.type === 'vertical' ? line.x - 5 : line.end} y1={line.type === 'vertical' ? line.end : line.y - 5} x2={line.type === 'vertical' ? line.x + 5 : line.end} y2={line.type === 'vertical' ? line.end : line.y + 5} />
                                </g>
                            ))}
                        </svg>
                      </div>
                    </div>
                </div>
              </React.Fragment>
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
                  <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>My Templates</h3>
                        <label htmlFor="template-upload" className={`upload-btn ${isProcessing ? 'disabled' : ''}`}>{isProcessing ? 'Uploading...' : '📂 Browse...'}</label>
                        <input type="file" id="template-upload" accept="image/png, image/jpeg" onChange={handleTemplateUpload} disabled={isProcessing} />
                      </div>
                      <div className="template-gallery" style={{ flex: 1, overflowY: 'auto', alignContent: 'flex-start' }}>
                        {customTemplates.map(template => (
                          <div key={template} className="template-item">
                            <div className="template-thumbnail-wrapper" onClick={() => handleSelectTemplateForEditing(template)}>
                              <img src={getAssetUrl('template', template)} alt={template} className="template-thumbnail" />
                              <div className="template-hover-overlay">Edit Template</div>
                            </div>
                            <div className="template-actions">
                                <button className="template-action-btn" onClick={(e) => { e.stopPropagation(); handleSelectTemplateForEditing(template, 'draw'); }} title="Edit Photo Areas">
                                  ⚃
                                </button>
                            </div>
                            <button className="delete-template-btn" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template); }} title={`Delete ${template}`}>&times;</button>
                            <p className="template-name">{template}</p>
                          </div>
                        ))}
                        {customTemplates.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No custom templates uploaded.</p>}
                      </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>Default Templates</h3>
                        {isDeveloperMode && (
                          <div>
                            <label htmlFor="default-template-upload" className={`upload-btn ${isProcessing ? 'disabled' : ''}`} style={{fontSize: '0.75rem', padding: '4px 8px'}}>{isProcessing ? '...' : '📂 Browse...'}</label>
                            <input type="file" id="default-template-upload" accept="image/png, image/jpeg" onChange={handleDefaultTemplateUpload} disabled={isProcessing} />
                          </div>
                        )}
                      </div>
                      <div className="template-gallery" style={{ flex: 1, overflowY: 'auto', alignContent: 'flex-start' }}>
                        {defaultTemplates.map(template => (
                          <div key={template} className={`template-item ${enabledDefaultTemplates.includes(template) ? 'enabled' : ''}`}>
                            <div className="template-thumbnail-wrapper" onClick={() => handleToggleDefaultTemplate(template)}>
                              <img src={getAssetUrl('template', template)} alt={template} className="template-thumbnail" />
                              <div className="template-hover-overlay">{enabledDefaultTemplates.includes(template) ? '✅ Enabled (Click to Disable)' : 'Click to Enable'}</div>
                              {isDeveloperMode && <button className="delete-template-btn" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template); }} title={`Delete ${template}`}>&times;</button>}
                            </div>
                            <div className="template-actions">
                                <button className="template-action-btn" onClick={(e) => { e.stopPropagation(); handleSelectTemplateForEditing(template); }} title="Edit Template Text/Effects">✎</button>
                            </div>
                            <p className="template-name" onClick={() => handleToggleDefaultTemplate(template)}>{template}</p>
                          </div>
                        ))}
                        {defaultTemplates.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No default templates found.</p>}
                      </div>
                    </div>
                    
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      <style>{`
        .template-item.enabled .template-thumbnail { border: 3px solid var(--btn-primary); }
        .template-item.enabled .template-name { color: var(--btn-primary); font-weight: bold; }
      `}</style>

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
            <ol style={{ paddingLeft: '20px' }}>
              <li>
                <strong>System Setup (First Time):</strong>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>Click the <strong>Settings (⚙️)</strong> icon in the top-right corner.</li>
                  <li>In the "System Configuration" section, set the folder where your camera saves photos. You can paste the path (e.g., `C:\Photos\Booth`) or use the "Browse..." button.</li>
                  <li>Click <strong>"Set Watch Folder"</strong> to save. The system will now automatically detect new photos in that folder.</li>
                </ul>
              </li>
              <li>
                <strong>Template Management (in Settings):</strong>
                <ul style={{ paddingLeft: '20px' }}>
                  <li><strong>Upload:</strong> In the "My Templates" section, click "Browse..." to upload your own PNG or JPG template files.</li>
                  <li><strong>Edit:</strong> Click on any template (either "My Templates" or "Default Templates") to open the editor.</li>
                  <li><strong>Delete:</strong> Hover over a custom template and click the red '×' button to delete it. Default templates cannot be deleted.</li>
                </ul>
              </li>
              <li>
                <strong>Template Editor:</strong>
                <ul style={{ paddingLeft: '20px' }}>
                  <li><strong>Photo Areas:</strong> For custom templates, click and drag to draw rectangles where guest photos should appear. The numbers (1, 2, 3...) show the order. Use "Clear Areas" to start over.</li>
                  <li><strong>Add Text:</strong> Click "+ Add Text" to create a new text element.</li>
                  <li><strong>Edit Text:</strong> Click on a text element on the image to select it. The sidebar will show all editing options. You can also double-click the text on the image to edit its content directly.</li>
                  <li><strong>Text Styling:</strong> Use the "Format" and "Effects" tabs in the sidebar to change fonts, colors, sizes, add shadows, glows, outlines, and more.</li>
                  <li><strong>Save Changes:</strong> Click the "💾 Save" button in the toolbar to save all your area and text changes for that template.</li>
                </ul>
              </li>
              <li>
                <strong>Live Booth Operation:</strong>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>Click the <strong>Live Booth (🖥️)</strong> icon to go to the main screen.</li>
                  <li>Use the "Active Template" dropdown to select your desired template. The preview below will show the layout.</li>
                  <li>As you take photos, they will appear in the left-hand column. Click a thumbnail to view it larger.</li>
                  <li>Use the <strong>✅ Select</strong> button to add a photo to your final design. The selected photos will appear in the template preview on the right.</li>
                  <li>You must select the exact number of photos required by the template.</li>
                  <li>Use the <strong>🗑️ Delete</strong> button to permanently remove a bad photo from the system.</li>
                  <li>Once all photo slots are filled, a <strong>"Proceed"</strong> button will appear. Click it to go to the final step.</li>
                </ul>
              </li>
              <li>
                <strong>Final Preview & Finalize:</strong>
                <ul style={{ paddingLeft: '20px' }}>
                  <li><strong>Adjust Position:</strong> In the final preview, you can click and drag each guest photo within its frame to get the perfect position.</li>
                  <li><strong>Print:</strong> Enter the number of copies and click "Print Now".</li>
                  <li><strong>Email:</strong> Enter a guest's email and click "Send Email". This will also prompt you to save a local copy of the final image.</li>
                  <li><strong>Save:</strong> Click "Save as JPG..." to manually download the image.</li>
                  <li><strong>Navigation:</strong> Use the top-left <strong>⬅ Back</strong> arrow to return to the photo selection screen without losing your choices. Click <strong>❌ Reject</strong> to clear everything and start a new session.</li>
                </ul>
              </li>
            </ol>
            <button onClick={() => setShowInstructions(false)} className="secondary-btn">Close</button>
          </div>
        </div>
      )}

      {/* --- Global Context Menu --- */}
      {contextMenu.visible && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <ul>
            <li onClick={() => {
              handleDuplicateText(contextMenu.itemIndex);
              setContextMenu({ visible: false, x: 0, y: 0, itemIndex: null });
            }}>
              Duplicate Text
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;function drawSelectionArea(context, selection) {
  context.save();
  context.scale(zoomRatio, zoomRatio);
  
  // Original selection drawing logic (without zoom)
  context.beginPath();
  context.rect(selection.x, selection.y, selection.width, selection.height);
  context.fillStyle = '#0000ff';
  context.fill();
  
  context.restore();
}
