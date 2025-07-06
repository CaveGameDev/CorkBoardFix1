// Chat.js
import React from 'react';
import { attemptPlayAudio, toggleAudio, skipAudio } from './audio.js';
import { generateEmoji } from './utils.js'; // Assuming generateEmoji is defined in utils.js

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
    
    attemptPlayAudio(); 
    
    const trimmedInput = input.trim();
    const AI_EMOJI_COMMAND_PREFIX = '!emoji '; // This constant was defined locally

    if (trimmedInput.startsWith('!') || trimmedInput.startsWith('/')) {
        setLocalMessages(prev => [...prev, { type: 'user', text: trimmedInput }]);
        const command = trimmedInput.toLowerCase();
        
        if (command === '!pause') {
            onCommand('toggleMusic');
            setLocalMessages(prev => [...prev, { type: 'bot', text: 'Toggling music...' }]);
        } else if (command === '!skip') {
            onCommand('skipMusic');
            setLocalMessages(prev => [...prev, { type: 'bot', text: 'Skipping song...' }]);
        } else if (command === '/archive board') {
            onCommand('archive');
            setLocalMessages(prev => [...prev, { type: 'bot', text: 'Archiving current board state...' }]);
        } else if (command === '/archive view') {
            onCommand('viewArchives');
            setLocalMessages(prev => [...prev, { type: 'bot', text: 'Opening archives...' }]);
        } else if (trimmedInput.startsWith(AI_EMOJI_COMMAND_PREFIX)) {
            const expression = trimmedInput.substring(AI_EMOJI_COMMAND_PREFIX.length).trim();
            if (expression) {
                try {
                    const emoji = await generateEmoji(expression);
                    setLocalMessages(prev => [...prev, { type: 'bot', text: `Generated emoji for '${expression}': ${emoji}` }]);
                } catch (error) {
                    console.error("Error generating emoji:", error);
                    setLocalMessages(prev => [...prev, { type: 'bot', text: `Failed to generate emoji for '${expression}'.` }]);
                }
            } else {
                setLocalMessages(prev => [...prev, { type: 'bot', text: 'Please provide an expression after !emoji' }]);
            }
        }
        else {
            setLocalMessages(prev => [...prev, { type: 'bot', text: 'Command not recognized. Try !pause, !skip, /archive board, /archive view, or !emoji <expression>' }]);
        }
    } else {
        onSendChat(trimmedInput);
    }
    
    setInput('');
  };

  const allMessages = [
    ...localMessages.map(msg => ({ ...msg, type: msg.type === 'user' ? 'self' : msg.type })), 
    ...chatMessages.map(msg => ({
        ...msg,
        type: msg.username === username ? 'self' : 'peer' 
    }))
  ].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)); 

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
        {allMessages.map((msg, i) => (
          <div key={msg.id || `local-${i}`} className={`chat-message ${msg.type}`}>
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

export default Chat;