import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const BACKEND_URL = 'http://localhost:5000'; // Define your backend URL

function App() {
  // Global state
  const [mode, setMode] = useState('live'); // 'live' or 'setup'
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Live Booth Mode State
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [mergedPhoto, setMergedPhoto] = useState(null); // Merged photo for final preview { url, originalPath, templateName }
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
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
  const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const templateImageRef = useRef(null);
  const lastPhotoNameRef = useRef(null);

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

    const handleNewPhoto = (photo) => {
      console.log('New photo received:', photo);
      const photoUrl = getAssetUrl('photo', photo.name);
      setCurrentPhoto({ name: photo.name, url: photoUrl, path: photo.path });
      setMergedPhoto(null); // Clear any previous merged photo
    };

    // Poll for new photos
    const pollNewPhoto = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/latest-photo`);
        if (res.ok) {
          const photo = await res.json();
          if (photo && photo.name && photo.name !== lastPhotoNameRef.current) {
            lastPhotoNameRef.current = photo.name;
            handleNewPhoto(photo);
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

  // Helper to get the correct asset URL based on environment
  const getAssetUrl = (type, name) => {
    return `${BACKEND_URL}/${type}s/${name}`;
  };

  // --- Live Booth Mode Handlers ---
  const handleApproveAndPreview = async () => {
    if (!currentPhoto || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestPhotoPath: currentPhoto.path,
          templateName: activeTemplate,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to merge image');
      }

      const data = await res.json();

      setMergedPhoto({
        url: data.outputUrl, // This is the output URL sent from backend
        originalPath: currentPhoto.path, // Store original path for finalization
        templateName: activeTemplate, // Store template name for finalization
        originalName: currentPhoto.name
      });
      setCurrentPhoto(null);
      setTimeout(() => {
        alert('Photo approved! Review the final card before saving or printing.');
      }, 0); // Allow UI to update before showing alert
    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred.';
      alert(`Failed to process photo: ${errorMessage}`);
      console.error('Error merging/printing:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    if (isProcessing) return;
    setCurrentPhoto(null);
    setMergedPhoto(null);
    alert('Action cancelled. Waiting for a new photo.');
  };

  const handlePrint = async () => {
    if (!mergedPhoto || isProcessing) return;
    setIsProcessing(true);

    // This config object is sent to the backend to save the file and then print it.
    const printConfig = {
      guestPhotoName: mergedPhoto.originalName,
      guestPhotoPath: mergedPhoto.originalPath,
      templateName: mergedPhoto.templateName,
      printerName: selectedPrinter,
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

      setMergedPhoto(null); // Reset the view
      setTimeout(() => {
        alert('Print command sent! The image is also saved in the "outputs" folder.');
      }, 0); // Allow UI to update before showing alert
    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred.';
      alert(`Failed to print image: ${errorMessage}`);
      console.error(`Error during print action:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!mergedPhoto) return;

    // Create a link element in memory
    const link = document.createElement('a');
    // The mergedPhoto.url is a 'data:image/jpeg;base64,...' URL from the preview
    link.href = mergedPhoto.url;
    // Suggest a filename for the user's "Save As" dialog
    link.download = `photobooth-${Date.now()}.jpg`;

    // Append to the document, programmatically click it, and then remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setMergedPhoto(null); // Reset the view to wait for the next photo
    setTimeout(() => {
      alert('Image saved! Waiting for the next photo.');
    }, 0); // Allow UI to update before showing alert
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
    setIsDrawing(true);
    const point = getCoords(e);
    setStartPoint(point);
    setSelectionBox({ x: point.x, y: point.y, width: 0, height: 0 });
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
    setSelectionBox(newBox);
  };

  const handleMouseUp = () => {
    if (mode !== 'setup') return;
    setIsDrawing(false);
  };

  const handleSaveConfig = async () => {
    if (selectionBox.width === 0 || selectionBox.height === 0) {
      alert("Please draw a selection box on the template first.");
      return;
    }
    const img = templateImageRef.current;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const realCoords = {
      x: selectionBox.x * scaleX,
      y: selectionBox.y * scaleY,
      width: selectionBox.width * scaleX,
      height: selectionBox.height * scaleY,
    };

    try {
      const newConfig = { ...appConfig };
      newConfig[selectedTemplateForEditing] = realCoords;

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
      setSelectionBox({ x: 0, y: 0, width: 0, height: 0 }); // Reset selection
      setTimeout(() => {
        alert(`Configuration saved for ${selectedTemplateForEditing}!`);
      }, 0); // Allow UI to update before showing alert
    } catch (error) {
      alert("Failed to save configuration. Check the console.");
      console.error("Error saving config:", error);
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
      alert('Failed to delete template. See console for details.');
      console.error('Error deleting template:', error);
    } finally {
      setIsProcessing(false);
    }
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
      setTimeout(() => {
        alert(`Template '${file.name}' uploaded successfully!`);
      }, 0); // Allow UI to update before showing alert
    } catch (error) {
      alert('Failed to upload template. See console for details.');
      console.error('Error uploading template:', error);
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
      alert("Please enter a valid folder path.");
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
      setTimeout(() => {
        alert(data.message || 'Camera folder set successfully');
      }, 0); // Allow UI to update before showing alert
    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred.';
      alert(`Failed to set camera folder: ${errorMessage}`);
      console.error("Error setting camera folder:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Main Render ---
  return (
    <div className="dashboard">
      <header className="header">
        <h1>Photo Booth Dashboard</h1>
        <div className="help-icon" onClick={() => setShowInstructions(true)} title="Show Instructions">
          ?
        </div>
        <div className="mode-switcher">
          <button onClick={() => setMode('live')} className={mode === 'live' ? 'active' : ''}>Live Booth</button>
          <button onClick={() => setMode('setup')} className={mode === 'setup' ? 'active' : ''}>Template Setup</button>
        </div>
      </header>

      {mode === 'live' ? (
        mergedPhoto ? (
          // --- Final Preview and Action Step ---
          <main className="main-content">
            <div className="preview-container">
              <h2>Final Preview</h2>
              <div className="photo-review">
                <img src={mergedPhoto.url} alt="Final merged card" />
              </div>
            </div>
            <div className="controls-container">
              <h2>Finalize</h2>
              <div className="control-group">
                <label htmlFor="printer-select">Select Printer:</label>
                <select id="printer-select" value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} disabled={printers.length === 0 || isProcessing}>
                  {printers.length > 0 ? printers.map(p => <option key={p} value={p}>{p}</option>) : <option>No printers found</option>}
                </select>
              </div>
              <div className="actions">
                <button onClick={handlePrint} disabled={isProcessing} className="approve-btn">
                  {isProcessing ? 'Printing...' : '🖨️ Print Now'}
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
              <h2>Live Preview</h2>
              {currentPhoto ? (
                <div className="photo-review">
                  <img src={currentPhoto.url} alt="Live from booth" />
                </div>
              ) : (
                <div className="no-photo"><p>Waiting for a new photo...</p></div>
              )}
            </div>
            <div className="controls-container">
              <h2>Controls</h2>
              <div className="control-group">
                <label htmlFor="template-select">Active Template:</label>
                <select id="template-select" value={activeTemplate} onChange={(e) => setActiveTemplate(e.target.value)} disabled={templates.length === 0 || isProcessing}>
                  {templates.length > 0 ? templates.map(t => <option key={t} value={t}>{t}</option>) : <option>No templates found</option>}
                </select>
              </div>
              <div className="actions">
                <button onClick={handleApproveAndPreview} disabled={!currentPhoto || isProcessing} className="approve-btn">
                  {isProcessing ? 'Processing...' : '✅ Approve & Preview Card'}
                </button>
                <button onClick={handleReject} disabled={!currentPhoto || isProcessing} className="reject-btn">
                  ❌ Reject Photo
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
                <p>Draw a rectangle on the template where the guest's photo should appear.</p>
                <div className="template-editor" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                  <img ref={templateImageRef} src={getAssetUrl('template', selectedTemplateForEditing)} alt="Template for setup" />
                  {selectionBox.width > 0 && (
                    <div className="selection-box" style={{
                      left: `${selectionBox.x}px`,
                      top: `${selectionBox.y}px`,
                      width: `${selectionBox.width}px`,
                      height: `${selectionBox.height}px`,
                    }} />
                  )}
                </div>
                <div className="actions">
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
                        onClick={() => setSelectedTemplateForEditing(template)}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                  <li>Switch to "Template Setup" mode using the button at the top.</li>
                  <li>In the "Template Management" section, you can see all available templates.</li>
                  <li>If your template isn't listed, use the "Choose File" button to upload it.</li>
                  <li>Click on a template from the gallery to select it for editing.</li>
                  <li>Click and drag your mouse over the template image to draw a box where the guest's photo should appear.</li>
                  <li>Click "Save Configuration". A confirmation will appear.</li>
                </ul>
              </li>
              <li>
                <strong>Live Booth Operation:</strong>
                <ul>
                  <li>Switch to "Live Booth" mode.</li>
                  <li>Select the template you want to use from the "Active Template" dropdown.</li>
                  <li>Take a photo with your camera. It will appear in the "Live Preview" area.</li>
                  <li>Click "Approve & Preview Card". The system will show you the final merged image.</li>
                  <li>In the "Finalize" panel, you can "Print Now", "Save as JPG..." to your computer, or "Reject".</li>
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
