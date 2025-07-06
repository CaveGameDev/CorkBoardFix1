// CorkBoard.js
import html2canvas from 'https://html2canvas.hertzen.com/dist/html2canvas.min.js'; // Import directly from CDN
import { 
    generateId, 
    getClientCoords, 
    getDistance, 
    getMidpoint, 
    waitForAllMediaToLoad, 
    isSuspiciousLink, 
    replaceEmojiCommands, 
    renderTextWithLinks 
} from './utils.js';
import { audio, fluorescentBuzzAudio, toggleAudio, skipAudio, attemptPlayAudio, isMusicUserPaused } from './audio.js';
import Chat from './Chat.js';

// Constants for CorkBoard
const ZOOM_SPEED = 0.1;
const MIN_ZOOM = 0.01; 
const MAX_ZOOM = 1; 
const ZOOM_THRESHOLD_FOR_DARKNESS = 0.15; 
const ZOOM_THRESHOLD_FOR_AUDIO_CHANGE = 0.05; 
const MOVE_SPEED = 20;
const NOTE_MOVE_SPEED = 10;
const MAX_VIDEO_SIZE_MB = 50; 
const MAX_VIDEO_DURATION_SECONDS = 30;
const AI_IMAGE_COMMAND_PREFIX = '!ai ';

function CorkBoard({ username }) { // username passed as prop from main.js
  const [newNoteText, setNewNoteText] = React.useState('');
  const [selectedImageFile, setSelectedImageFile] = React.useState(null); 
  const [selectedVideoFile, setSelectedVideoFile] = React.useState(null); 
  const [selectedArchive, setSelectedArchive] = React.useState(null);
  const [showArchives, setShowArchives] = React.useState(false); 
  const [isChatMinimized, setIsChatMinimized] = React.useState(false); 
  const [isDragOver, setIsDragOver] = React.useState(false); 
  const [isGeneratingAIImage, setIsGeneratingAIImage] = React.useState(false); 
  
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [showCommandsAsModal, setShowCommandsAsModal] = React.useState(false);

  const [draggingNoteId, setDraggingNoteId] = React.useState(null);
  const [dragStartCoords, setDragStartCoords] = React.useState(null); 
  const [draggedNoteInitialPos, setDraggedNoteInitialPos] = React.useState(null); 
  const [currentDragOffset, setCurrentDragOffset] = React.useState({ x: 0, y: 0 });

  const [boardOffset, setBoardOffset] = React.useState({ x: 0, y: 0 }); 
  const [isBoardDragging, setIsBoardDragging] = React.useState(false);
  const [boardDragStartCoords, setBoardDragStartCoords] = React.useState(null); 
  const [initialBoardOffsetDuringDrag, setInitialBoardOffsetDuringDrag] = React.useState(null); 

  const [zoom, setZoom] = React.useState(1);
  
  const [isPinching, setIsPinching] = React.useState(false);
  const [initialPinchDistance, setInitialPinchDistance] = React.useState(0);
  const [initialPinchMidpoint, setInitialPinchMidpoint] = React.useState(null);
  const [initialBoardStateForPinch, setInitialBoardStateForPinch] = React.useState(null); 

  const boardStateRef = React.useRef({ offset: { x: 0, y: 0 }, zoom: 1 });

  const fileInputRef = React.useRef(null);

  boardStateRef.current = { offset: boardOffset, zoom: zoom };

  const [selectedNote, setSelectedNote] = React.useState(null); 
  const boardRef = React.useRef();
  const viewportRef = React.useRef();
  const darknessOverlayRef = React.useRef(); 

  // in-memory state
  const [notes, setNotes] = React.useState([]);
  const [chatMessages, setChatMessages] = React.useState([]);
  const [archives, setArchives] = React.useState([]);

  // DB Interaction - kept within CorkBoard as it directly manages its state
  React.useEffect(() => {
    const handleMessage = (e) => {
      const msg = e.data;
      if (msg?.type === 'BOARD_DATA') {
        const bd = msg.boardData || {};
        setNotes(bd.notes || []);
        setChatMessages(bd.chatMessages || []);
        setArchives(bd.archives || []);
        console.log('Parent: Received BOARD_DATA. Notes count:', (bd.notes || []).length);
        console.log('Parent: Received BOARD_DATA. Chat messages count:', (bd.chatMessages || []).length);
      }
    };

    window.addEventListener('message', handleMessage);

    const frame = document.getElementById('db-frame');
    
    const requestDataIfFrameLoaded = () => {
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'REQUEST_BOARD' }, '*');
            console.log('Parent: Sent REQUEST_BOARD to iframe after iframe loaded.');
        }
    };

    if (frame) {
        if (frame.contentWindow && frame.contentWindow.document.readyState === 'complete') {
            requestDataIfFrameLoaded();
        } else {
            frame.onload = requestDataIfFrameLoaded;
        }
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (frame) {
          frame.onload = null; 
      }
    };
  }, []); 
    
  React.useEffect(() => {
    const frame = document.getElementById('db-frame');
    if (frame) {
      frame.contentWindow.postMessage({
        type: 'SAVE_BOARD',
        boardData: { notes, chatMessages, archives }
      }, '*');
    }
  }, [notes, chatMessages, archives]);

  const handleSendChat = (text) => {
    const newMsg = {
      id: generateId(),
      text,
      username,
      created_at: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, newMsg]);
  };

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    
    setIsChatMinimized(window.innerWidth < 768);

    return () => window.removeEventListener('resize', handleResize);
  }, []); 

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || showCommandsAsModal || showArchives || selectedArchive) {
        return;
      }

      if (e.key === 'Escape') {
        if (selectedArchive) { 
          setSelectedArchive(null);
          e.preventDefault();
          return;
        }
        if (showArchives) { 
          setShowArchives(false);
          e.preventDefault();
          return;
        }
        if (showCommandsAsModal) { 
          setShowCommandsAsModal(false);
          e.preventDefault();
          return;
        }
        if (selectedNote) { 
          setSelectedNote(null);
          e.preventDefault();
          return;
        }
        if (!isChatMinimized) { 
          setIsChatMinimized(true);
          e.preventDefault();
          return;
        }
      }

      if (selectedNote) {
        switch(e.key) {
          case 'ArrowLeft':
            updateNotePosition(selectedNote, -NOTE_MOVE_SPEED, 0);
            e.preventDefault();
            break;
          case 'ArrowRight':
            updateNotePosition(selectedNote, NOTE_MOVE_SPEED, 0);
            e.preventDefault();
            break;
          case 'ArrowUp':
            updateNotePosition(selectedNote, 0, -NOTE_MOVE_SPEED);
            e.preventDefault();
            break;
          case 'ArrowDown':
            updateNotePosition(selectedNote, 0, NOTE_MOVE_SPEED);
            e.preventDefault();
            break;
          case 'r':
            updateNoteRotation(selectedNote, (Math.random() - 0.5) * 10);
            e.preventDefault(); 
            break;
        }
      } else if (!showArchives && !selectedArchive && !isChatMinimized && !showCommandsAsModal) { 
        switch(e.key) {
          case 'ArrowLeft':
            setBoardOffset(pos => ({ ...pos, x: pos.x + MOVE_SPEED }));
            e.preventDefault();
            break;
          case 'ArrowRight':
            setBoardOffset(pos => ({ ...pos, x: pos.x - MOVE_SPEED }));
            e.preventDefault();
            break;
          case 'ArrowUp':
            setBoardOffset(pos => ({ ...pos, y: pos.y + MOVE_SPEED }));
            e.preventDefault();
            break;
          case 'ArrowDown':
            setBoardOffset(pos => ({ ...pos, y: pos.y - MOVE_SPEED }));
            e.preventDefault();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNote, boardOffset, showArchives, selectedArchive, isChatMinimized, showCommandsAsModal]);

  const updateNotePosition = (noteToUpdate, deltaX, deltaY) => {
    if (!noteToUpdate) return;
    const updatedPos = {
      x: (noteToUpdate.position?.x || 0) + deltaX,
      y: (noteToUpdate.position?.y || 0) + deltaY,
      rotation: noteToUpdate.position?.rotation || 0
    };
    setNotes(prev => prev.map(n =>
      n.id === noteToUpdate.id ? { ...n, position: updatedPos } : n
    ));
    setSelectedNote(prev => prev?.id === noteToUpdate.id
      ? { ...prev, position: updatedPos }
      : prev
    );
  };

  const updateNoteRotation = (noteToUpdate, rotationDelta) => {
    if (!noteToUpdate) return;
    const updatedPos = {
      x: noteToUpdate.position?.x || 0,
      y: noteToUpdate.position?.y || 0,
      rotation: (noteToUpdate.position?.rotation || 0) + rotationDelta
    };
    setNotes(prev => prev.map(n =>
      n.id === noteToUpdate.id ? { ...n, position: updatedPos } : n
    ));
    setSelectedNote(prev => prev?.id === noteToUpdate.id
      ? { ...prev, position: updatedPos }
      : prev
    );
  };

  const handleNoteMouseDown = (e, note) => {
    e.stopPropagation(); 
    e.preventDefault(); 
    setSelectedNote(note); 
    setDraggingNoteId(note.id);
    const { x, y } = getClientCoords(e);
    setDragStartCoords({ x, y });
    setDraggedNoteInitialPos(note.position);
    setCurrentDragOffset({ x: 0, y: 0 }); 
  };

  const handleBoardInteractionStart = (e) => {
    let currentTarget = e.target;
    while (currentTarget && currentTarget !== document.body) {
      if (currentTarget.classList.contains('chat-container') || currentTarget.classList.contains('chat-minimized-button') || 
          currentTarget.classList.contains('note-pile') || currentTarget.classList.contains('post-it') ||
          currentTarget.classList.contains('command-minimized-button') || currentTarget.classList.contains('command-modal-overlay')) {
        e.stopPropagation(); 
        return;
      }
      currentTarget = currentTarget.parentNode;
    }

    const isTargetValidForBoardInteraction = e.target.id === 'corkboard' || e.target.id === 'viewport';
    if (!isTargetValidForBoardInteraction) {
        return;
    }

    e.preventDefault(); 

    if (e.touches && e.touches.length === 2) {
        setIsPinching(true);
        const p1 = getClientCoords(e, 0);
        const p2 = getClientCoords(e, 1);
        setInitialPinchDistance(getDistance(p1, p2));
        setInitialPinchMidpoint(getMidpoint(p1, p2));
        setInitialBoardStateForPinch({ offset: boardStateRef.current.offset, zoom: boardStateRef.current.zoom });
        setSelectedNote(null); 
    } else if (e.touches && e.touches.length === 1 || e.type === 'mousedown') {
        setIsBoardDragging(true);
        const { x, y } = getClientCoords(e);
        setBoardDragStartCoords({ x, y });
        setInitialBoardOffsetDuringDrag(boardStateRef.current.offset); 
        setSelectedNote(null); 
    }
  };

  React.useEffect(() => {
    const handleBoardInteractionMove = (e) => {
      const { x: clientX, y: clientY } = getClientCoords(e);

      if (draggingNoteId && dragStartCoords && draggedNoteInitialPos) {
        e.preventDefault(); 
        const deltaX_screen = clientX - dragStartCoords.x;
        const deltaY_screen = clientY - dragStartCoords.y;
        
        const currentZoom = boardStateRef.current.zoom;
        const deltaX_world = deltaX_screen / currentZoom;
        const deltaY_world = deltaY_screen / currentZoom;

        setCurrentDragOffset({ x: deltaX_world, y: deltaY_world }); 
      } else if (isPinching && initialPinchDistance > 0 && initialPinchMidpoint && initialBoardStateForPinch) {
        e.preventDefault(); 
        if (e.touches && e.touches.length === 2) {
            const p1 = getClientCoords(e, 0);
            const p2 = getClientCoords(e, 1);
            const currentPinchDistance = getDistance(p1, p2);
            const currentPinchMidpoint = getMidpoint(p1, p2);

            const zoomFactor = currentPinchDistance / initialPinchDistance;
            let newZoom = initialBoardStateForPinch.zoom * zoomFactor;
            newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
            newZoom = parseFloat(newZoom.toFixed(2)); 

            const worldMidX = (initialPinchMidpoint.x - initialBoardStateForPinch.offset.x) / initialBoardStateForPinch.zoom;
            const worldMidY = (initialPinchMidpoint.y - initialBoardStateForPinch.y) / initialBoardStateForPinch.zoom;

            const newOffsetX = currentPinchMidpoint.x - (worldMidX * newZoom);
            const newOffsetY = currentPinchMidpoint.y - (worldMidY * newZoom);

            boardStateRef.current = { offset: { x: newOffsetX, y: newOffsetY }, zoom: newZoom };
            if (boardRef.current) {
                boardRef.current.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px) scale(${newZoom})`;
            }
        } else {
            setIsPinching(false);
            setIsBoardDragging(false); 
        }
      } else if (isBoardDragging && boardDragStartCoords && initialBoardOffsetDuringDrag) {
        e.preventDefault(); 
        const deltaX = clientX - boardDragStartCoords.x;
        const deltaY = clientY - boardDragStartCoords.y;
        
        const newX = initialBoardOffsetDuringDrag.x + deltaX;
        const newY = initialBoardOffsetDuringDrag.y + deltaY;

        boardStateRef.current = { offset: { x: newX, y: newY }, zoom: boardStateRef.current.zoom }; 
        if (boardRef.current) {
            boardRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${boardStateRef.current.zoom})`;
        }
      }
    };

    const handleBoardInteractionEnd = async (e) => {
      if (draggingNoteId && dragStartCoords && draggedNoteInitialPos) {
        const currentZoom = boardStateRef.current.zoom; 
        const finalX = draggedNoteInitialPos.x + (e.clientX - dragStartCoords.x) / currentZoom;
        const finalY = draggedNoteInitialPos.y + (e.clientY - dragStartCoords.y) / currentZoom;
        
        const noteToUpdate = notes.find(n => n.id === draggingNoteId);
        if (noteToUpdate) {
            // NOTE: 'room' is a global variable from Base.html or external script.
            // In a real app, you'd manage this dependency better (e.g., via Context API or prop drilling).
            if (typeof room !== 'undefined' && room.collection) {
                await room.collection('note_v2').update(draggingNoteId, {
                    position: {
                        x: finalX,
                        y: finalY,
                        rotation: noteToUpdate.position?.rotation || 0
                    }
                });
            } else {
                console.warn("Global 'room' object or 'collection' method not found. Note position not saved to DB.");
                // Update local state even if DB update fails
                setNotes(prev => prev.map(n =>
                    n.id === draggingNoteId ? { ...n, position: {x: finalX, y: finalY, rotation: noteToUpdate.position?.rotation || 0}} : n
                ));
            }
        }
        setDraggingNoteId(null);
        setDragStartCoords(null);
        setDraggedNoteInitialPos(null);
        setCurrentDragOffset({ x: 0, y: 0 });
      }

      if (isPinching || isBoardDragging) {
        setBoardOffset(boardStateRef.current.offset);
        setZoom(boardStateRef.current.zoom); 
      }

      setIsPinching(false);
      setInitialPinchDistance(0);
      setInitialPinchMidpoint(null);
      setInitialBoardStateForPinch(null);

      setIsBoardDragging(false);
      setBoardDragStartCoords(null);
      setInitialBoardOffsetDuringDrag(null);
    };

    window.addEventListener('mousemove', handleBoardInteractionMove);
    window.addEventListener('mouseup', handleBoardInteractionEnd);
    window.addEventListener('touchmove', handleBoardInteractionMove, { passive: false }); 
    window.addEventListener('touchend', handleBoardInteractionEnd);
    window.addEventListener('touchcancel', handleBoardInteractionEnd); 

    return () => {
      window.removeEventListener('mousemove', handleBoardInteractionMove);
      window.removeEventListener('mouseup', handleBoardInteractionEnd);
      window.removeEventListener('touchmove', handleBoardInteractionMove, { passive: false });
      window.removeEventListener('touchend', handleBoardInteractionEnd);
      window.removeEventListener('touchcancel', handleBoardInteractionEnd);
    };
  }, [
    draggingNoteId, dragStartCoords, draggedNoteInitialPos, notes, 
    isBoardDragging, boardDragStartCoords, initialBoardOffsetDuringDrag, 
    isPinching, initialPinchDistance, initialPinchMidpoint, initialBoardStateForPinch, 
    MIN_ZOOM, MAX_ZOOM 
  ]);

  const handleWheel = React.useCallback((e) => {
    if (showArchives || selectedArchive || showCommandsAsModal) { 
        return;
    }

    e.preventDefault(); 

    const { offset, zoom: currentZoom } = boardStateRef.current;
    const viewportRect = viewportRef.current.getBoundingClientRect();
    
    const cursorX = e.clientX - viewportRect.left;
    const cursorY = e.clientY - viewportRect.top;

    const boardX = (cursorX - offset.x) / currentZoom;
    const boardY = (cursorY - offset.y) / currentZoom;

    let newZoom = currentZoom * (1 + (e.deltaY > 0 ? -1 : 1) * ZOOM_SPEED);
    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    newZoom = parseFloat(newZoom.toFixed(2)); 

    const newOffsetX = cursorX - (boardX * newZoom);
    const newOffsetY = cursorY - (boardY * newZoom);

    setZoom(newZoom);
    setBoardOffset({ x: newOffsetX, y: newOffsetY });
  }, [showArchives, selectedArchive, showCommandsAsModal, ZOOM_SPEED, MIN_ZOOM, MAX_ZOOM]); 

  React.useEffect(() => {
    const viewportEl = viewportRef.current;
    if (viewportEl) {
      viewportEl.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (viewportEl) {
        viewportEl.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  React.useEffect(() => {
    const darknessOverlay = darknessOverlayRef.current;
    if (darknessOverlay) {
        let opacity = 0;
        if (zoom < ZOOM_THRESHOLD_FOR_DARKNESS) {
            opacity = 1 - (zoom - MIN_ZOOM) / (ZOOM_THRESHOLD_FOR_DARKNESS - MIN_ZOOM);
            opacity = Math.min(1, Math.max(0, opacity)); 
        }
        darknessOverlay.style.opacity = opacity;
    }

    if (zoom <= ZOOM_THRESHOLD_FOR_AUDIO_CHANGE) {
      audio.pause();
      if (fluorescentBuzzAudio.paused) {
        fluorescentBuzzAudio.play().catch(err => console.warn("Buzz audio play failed:", err));
      }
    } else {
      fluorescentBuzzAudio.pause();
      if (!isMusicUserPaused && audio.paused) { 
        audio.play().catch(err => console.warn("Main audio resume failed:", err));
      }
    }
  }, [zoom]); // Removed isMusicUserPaused, ZOOM_THRESHOLD_FOR_DARKNESS, ZOOM_THRESHOLD_FOR_AUDIO_CHANGE, MIN_ZOOM from deps as they are constants

  const processSelectedFile = async (file) => {
    if (!file) return;

    attemptPlayAudio(); 

    const fileType = file.type;

    if (fileType.startsWith('image/')) { 
        setSelectedImageFile(file);
        setSelectedVideoFile(null); 
    } else if (fileType.startsWith('video/mp4')) {
        setSelectedImageFile(null); 
        setSelectedVideoFile(null); 

        if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) { 
            alert(`Video file is too large. Max ${MAX_VIDEO_SIZE_MB}MB.`);
            return;
        }

        const videoURL = URL.createObjectURL(file);
        const videoElement = document.createElement('video'); 
        videoElement.preload = 'metadata'; 

        videoElement.onloadedmetadata = async () => {
            URL.revokeObjectURL(videoURL); 

            if (videoElement.duration > MAX_VIDEO_DURATION_SECONDS) {
                alert(`Video is too long. Max ${MAX_VIDEO_DURATION_SECONDS} seconds.`);
                return; 
            }
            
            setSelectedVideoFile(file);
        };

        videoElement.onerror = (errorEvent) => {
            URL.revokeObjectURL(videoURL);
            console.error("Error loading video metadata:", errorEvent);
            alert("Failed to load video. Please ensure it's a valid MP4.");
        };
        videoElement.src = videoURL; 
    } else {
        alert('Please drop an image file (JPG, PNG, GIF, WebP) or an MP4 video (max 30 seconds).');
        setSelectedImageFile(null);
        setSelectedVideoFile(null);
    }
  };

  const handleCreateNote = async () => {
    if (isGeneratingAIImage) { 
        alert("An AI operation is already in progress. Please wait.");
        return;
    }

    attemptPlayAudio(); 
    
    if (newNoteText.startsWith(AI_IMAGE_COMMAND_PREFIX)) {
        const promptText = newNoteText.substring(AI_IMAGE_COMMAND_PREFIX.length).trim();
        if (!promptText) { alert("Please provide a prompt after !ai"); return; }
        setIsGeneratingAIImage(true);
        const { offset, zoom } = boardStateRef.current;
        const cx = window.innerWidth/2, cy = window.innerHeight/2;
        const wx = (cx - offset.x)/zoom, wy = (cy - offset.y)/zoom;
        try {
          const aiImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}`;
          const newNote = {
            id: generateId(),
            text: `AI Generated: "${promptText}"`,
            mediaUrl: aiImageUrl,
            mediaType: 'image',
            position: { x: wx, y: wy, rotation: (Math.random()-0.5)*10 },
            username: username // Add username to AI generated notes
          };
          setNotes(prev => [...prev, newNote]);
        } catch (err) {
          console.error("AI error:", err);
          alert("Failed to generate image. Try again.");
        } finally {
          setIsGeneratingAIImage(false);
        }
        setNewNoteText('');
        return;
    }

    const AI_EMOJI_COMMAND_PATTERN = /!emoji\s+(.+)/g;
    let finalNoteText = newNoteText;
    if (AI_EMOJI_COMMAND_PATTERN.test(newNoteText)) { 
        setIsGeneratingAIImage(true); // Re-using this flag for any AI operation
        try {
            finalNoteText = await replaceEmojiCommands(newNoteText); 
        } catch (error) {
            console.error("Error processing emoji commands for note:", error);
            alert("Failed to process emoji commands. Please try again.");
            setIsGeneratingAIImage(false);
            return; 
        } finally {
            setIsGeneratingAIImage(false);
        }
    }

    if (isSuspiciousLink(finalNoteText)) {
        alert("Suspicious link detected! Links from tiny.cc or bit.ly are not allowed.");
        return;
    }

    let mediaUrl = null;
    let mediaType = null;

    if (selectedImageFile) {
      mediaType = 'image';
      mediaUrl = await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(selectedImageFile);
      });
    } else if (selectedVideoFile) {
      mediaType = 'video';
      mediaUrl = await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(selectedVideoFile);
      });
    }
    
    if (!finalNoteText.trim() && !mediaUrl) {
        alert("Please enter some text, drag/drop an image/video, or use an AI command.");
        return;
    }

    const { offset, zoom } = boardStateRef.current;
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    const wx = (cx - offset.x)/zoom, wy = (cy - offset.y)/zoom;

    const randomOffset = {
      x: (Math.random() - 0.5) * 200, 
      y: (Math.random() - 0.5) * 200
    };
    
    const newNote = {
      id: generateId(),
      text: finalNoteText,
      mediaUrl,
      mediaType,
      position: {
        x: wx + randomOffset.x,
        y: wy + randomOffset.y,
        rotation: (Math.random()-0.5)*10
      },
      username: username // Add username to notes
    };
    setNotes(prev => [...prev, newNote]);
    
    setNewNoteText('');
    setSelectedImageFile(null); 
    setSelectedVideoFile(null); 
  };

  const handleArchive = async () => {
    if (!boardRef.current) {
        console.error("Corkboard element not found for archiving.");
        return;
    }

    await waitForAllMediaToLoad(boardRef.current);

    const canvas = await html2canvas(boardRef.current, { 
        scale: 0.5, 
        useCORS: true 
    }); 
    
    const date = new Date();
    const filename = `corkboard-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}.png`;
    
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const dataUrl = canvas.toDataURL('image/png');
    const newArchive = {
      id: generateId(),
      imageUrl: dataUrl,
      timestamp: date.toISOString()
    };
    setArchives(prev => [...prev, newArchive]);
  };

  const handleCommand = (command) => {
    switch (command) {
      case 'toggleMusic': 
        toggleAudio();
        break;
      case 'skipMusic': 
        skipAudio();
        break;
      case 'archive':
        handleArchive();
        break;
      case 'viewArchives': 
        setShowArchives(true); 
        break;
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    processSelectedFile(file);
    e.target.value = ''; 
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false); 

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processSelectedFile(files[0]);
    }
  };

  return (
    <>
      <div id="darkness-overlay" ref={darknessOverlayRef}></div> 
      <Chat
        chatMessages={chatMessages}
        onSendChat={handleSendChat}
        onCommand={handleCommand}
        onMinimize={() => setIsChatMinimized(!isChatMinimized)}
        isMinimized={isChatMinimized}
        username={username}
      />
      
      {isChatMinimized && (
        <div className="chat-minimized-button" onClick={() => setIsChatMinimized(false)}>
          💬
        </div>
      )}

      {isMobile ? (
        <>
          {!showCommandsAsModal && (
            <div className="command-minimized-button" onClick={() => setShowCommandsAsModal(true)}>
              ❓
            </div>
          )}
          {showCommandsAsModal && (
            <div className="command-modal-overlay" onClick={() => setShowCommandsAsModal(false)}>
              <div className="command-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="command-modal-header">
                  <h3>Commands</h3>
                  <button className="command-modal-close" onClick={() => setShowCommandsAsModal(false)}>×</button>
                </div>
                <div className="command-list-content">
                  <strong>Available Commands:</strong>
                  <div><strong>!ai &lt;prompt&gt;</strong> - Generate an image with AI</div>
                  <div><strong>!emoji &lt;expression&gt;</strong> - Insert an AI-generated emoji</div>
                  <div><strong>!pause</strong> - Toggle music</div>
                  <div><strong>!skip</strong> - Skip current song</div>
                  <div><strong>/archive board</strong> - Save current board state</div>
                  <div><strong>/archive view</strong> - Open archived boards</div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="command-list-container">
          <strong>Available Commands:</strong>
          <div><strong>!ai &lt;prompt&gt;</strong> - Generate an image with AI</div>
          <div><strong>!emoji &lt;expression&gt;</strong> - Insert an AI-generated emoji</div>
          <div><strong>!pause</strong> - Toggle music</div>
          <div><strong>!skip</strong> - Skip current song</div>
          <div><strong>/archive board</strong> - Save current board state</div>
          <div><strong>/archive view</strong> - Open archived boards</div>
        </div>
      )}

      <div id="viewport" ref={viewportRef} className={isBoardDragging || isPinching ? 'dragging' : ''} 
           onMouseDown={handleBoardInteractionStart}
           onTouchStart={handleBoardInteractionStart}
      >
        <div id="corkboard" ref={boardRef} 
             style={{ 
                transform: `translate(${boardOffset.x}px, ${boardOffset.y}px) scale(${zoom})`, 
                width: '10000px', 
                height: '10000px' 
             }}
        >
          {notes.map((note) => {
            let currentX = note.position?.x || 50;
            let currentY = note.position?.y || 50;
            let currentRotation = note.position?.rotation || 0;

            if (draggingNoteId === note.id && draggedNoteInitialPos) {
              currentX = draggedNoteInitialPos.x + currentDragOffset.x;
              currentY = draggedNoteInitialPos.y + currentDragOffset.y;
              currentRotation = draggedNoteInitialPos.rotation; 
            }

            return (
              <div
                key={note.id}
                className={`post-it ${selectedNote?.id === note.id ? 'selected' : ''}`}
                onMouseDown={(e) => handleNoteMouseDown(e, note)} 
                onTouchStart={(e) => handleNoteMouseDown(e, note)} 
                style={{
                  left: `${currentX}px`, 
                  top: `${currentY}px`,
                  '--rotation': `${currentRotation}deg`,
                  zIndex: draggingNoteId === note.id ? 2001 : (selectedNote?.id === note.id ? 2000 : 1)
                }}
              >
                <div className="username">{note.username}</div>
                <div className="text" dangerouslySetInnerHTML={renderTextWithLinks(note.text || '')}></div>
                {note.mediaType === 'image' && note.mediaUrl && <img src={note.mediaUrl} alt="Note content" className="note-image" />}
                {note.mediaType === 'video' && note.mediaUrl && (
                    <video src={note.mediaUrl} controls muted loop playsInline className="note-image" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="note-pile">
        <div 
          className={`new-note ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
        >
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder={isGeneratingAIImage ? "AI generating... please wait." : "Write your note here, or drag & drop an image/video, or type !ai <prompt> or !emoji <expression>"}
            disabled={isGeneratingAIImage}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isGeneratingAIImage) {
                e.preventDefault();
                handleCreateNote();
              }
            }}
          />
          <div className="new-note-actions">
            {isMobile && ( 
              <>
                <input
                  type="file"
                  accept="image/*,video/mp4"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  style={{ display: 'none' }} 
                />
                <button onClick={() => fileInputRef.current.click()} disabled={isGeneratingAIImage}>
                  Upload Media
                </button>
              </>
            )}
            {(selectedImageFile || selectedVideoFile) && ( 
              <span className="file-name-preview">
                Media: {(selectedImageFile?.name || selectedVideoFile?.name)}
              </span>
            )}
            <button onClick={handleCreateNote} disabled={isGeneratingAIImage}>
              {isGeneratingAIImage ? 'Generating...' : 'Post Note'}
            </button>
          </div>
        </div>
      </div>

      <div className="key-controls">
        {selectedNote ? 
          "Note selected: Drag with mouse/touch, Arrow keys to move, R to rotate, ESC to deselect" :
          "Use mouse/touch to drag notes/board, Arrow keys to navigate board, Scroll to zoom"
        }
      </div>

      {showArchives && (
        <div className="archive-modal-overlay" onClick={() => setShowArchives(false)}>
          <div className="archive-modal-content" onClick={(e) => e.stopPropagation()}> 
            <div className="archive-modal-header">
              <h3>Archived Boards</h3>
              <button className="archive-modal-close" onClick={() => setShowArchives(false)}>×</button>
            </div>
            <div className="archive-list">
              {archives.length === 0 ? (
                <p style={{ color: '#aaa', textAlign: 'center', gridColumn: '1 / -1' }}>No archives yet. Use "/archive board" to save one!</p>
              ) : (
                archives.map((archive) => (
                  <div 
                    key={archive.id} 
                    className="archive-preview-item"
                    onClick={(e) => { e.stopPropagation(); setSelectedArchive(archive); }}
                    onTouchStart={(e) => { e.stopPropagation(); setSelectedArchive(archive); }} 
                  >
                    <img src={archive.imageUrl} alt="Board archive" />
                    <div className="archive-timestamp">
                      {new Date(archive.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedArchive && (
        <div 
          className="selected-archive-full-view"
          onClick={() => setSelectedArchive(null)}
          onTouchStart={() => setSelectedArchive(null)} 
        >
          <img 
            src={selectedArchive.imageUrl} 
            alt="Archive full view"
          />
        </div>
      )}
    </>
  );
}

export default CorkBoard;
