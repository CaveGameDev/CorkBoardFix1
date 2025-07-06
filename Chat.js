// Chat.js
// No imports, relying on global functions/React
function Chat({ chatMessages, onSendChat, onCommand, onMinimize, isMinimized, username }) {
  const [localMessages, setLocalMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [localMessages, chatMessages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // Attempt to play audio
    if (typeof attemptPlayAudio === 'function') { // Check if function exists globally
        attemptPlayAudio(); 
    } else {
        console.warn("attemptPlayAudio is not defined. Make sure audio.js is loaded.");
    }
    
    const trimmedInput = input.trim();
    const AI_EMOJI_COMMAND_PREFIX = '!emoji ';

    if (trimmedInput.startsWith('!') || trimmedInput.startsWith('/')) {
        // Assign a unique ID to local command messages
        setLocalMessages(prev => [...prev, { 
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Generate unique ID
            type: 'user', 
            text: trimmedInput 
        }]);
        const command = trimmedInput.toLowerCase();
        
        if (command === '!pause') {
            onCommand('toggleMusic');
            setLocalMessages(prev => [...prev, { 
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Generate unique ID
                type: 'bot', 
                text: 'Toggling music...' 
            }]);
        } else if (command === '!skip') {
            onCommand('skipMusic');
            setLocalMessages(prev => [...prev, { 
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Generate unique ID
                type: 'bot', 
                text: 'Skipping song...' 
            }]);
        } else if (command === '/archive board') {
            onCommand('archive');
            setLocalMessages(prev => [...prev, { 
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Generate unique ID
                type: 'bot', 
                text: 'Archiving current board state...' 
            }]);
        } else if (command === '/archive view') {
            onCommand('viewArchives');
            setLocalMessages(prev => [...prev, { 
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Generate unique ID
                type: 'bot', 
                text: 'Opening archives...' 
            }]);
        } else if (trimmedInput.startsWith(AI_EMOJI_COMMAND_PREFIX)) {
            const expression = trimmedInput.substring(AI_EMOJI_COMMAND_PREFIX.length).trim();
            if (expression) {
                try {
                    const emoji = await generateEmoji(expression); // Global function
                    setLocalMessages(prev => [...prev, { 
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Generate unique ID
                        type: 'bot', 
                        text: `Generated emoji for '${expression}': ${emoji}` 
                    }]);
                } catch (error) {
                    console.error("Error generating emoji:", error);
                    setLocalMessages(prev => [...prev, { 
                        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Generate unique ID
                        type: 'bot', 
                        text: `Failed to generate emoji for '${expression}'.` 
                    }]);
                }
            } else {
                setLocalMessages(prev => [...prev, { 
                    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Generate unique ID
                    type: 'bot', 
                    text: 'Please provide an expression after !emoji' 
                }]);
            }
        }
        else {
            setLocalMessages(prev => [...prev, { 
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9), // Generate unique ID
                type: 'bot', 
                text: 'Command not recognized. Try !pause, !skip, /archive board, /archive view, or !emoji <expression>' 
            }]);
        }
    } else {
        onSendChat(trimmedInput); // Assume onSendChat adds messages to chatMessages with unique IDs
    }
    
    setInput('');
  };

  // Combine and sort messages, ensuring each message from chatMessages also has an 'id'
  const allMessages = [
    ...localMessages, // localMessages now have unique IDs
    ...chatMessages.map(msg => ({
        ...msg,
        id: msg.id || (Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9)), // Fallback for chatMessages if id is missing
        type: msg.username === username ? 'self' : 'peer' 
    }))
  ].sort((a, b) => {
      // Ensure messages have a created_at property for sorting, or use current time as fallback
      const dateA = new Date(a.created_at || (a.id ? parseInt(a.id.split('-')[0]) : 0));
      const dateB = new Date(b.created_at || (b.id ? parseInt(b.id.split('-')[0]) : 0));
      return dateA - dateB;
  });

  if (isMinimized) {
    return null; 
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <span>Chat</span>
        <button className="chat-minimize-button" onClick={onMinimize}>&mdash;</button>
      </div>
      <div className="chat-messages">
        {allMessages.map((msg) => (
          // Use msg.id directly as the key, as all messages now have a unique ID
          <div key={msg.id} className={`chat-message ${msg.type}`}>
            {(msg.type === 'peer' || msg.type === 'self') && <div className="username">{msg.username}</div>}
            <div className="text">{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} /> 
      </div>
      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSend();
            }
          }}
          placeholder="Type a message or command..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
