// main.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import CorkBoard from './CorkBoard.js';

// DB and user setup (global for the application)
const username = localStorage.getItem('username')
  || prompt("Enter your username:", "Guest" + Math.floor(Math.random()*10000));
localStorage.setItem('username', username);

// Render the main React component
ReactDOM.createRoot(document.getElementById('app')).render(<CorkBoard username={username} />);