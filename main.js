// main.js
// No imports, relying on global functions/React/ReactDOM

// DB and user setup (global for the application)
const username = localStorage.getItem('username')
  || prompt("Enter your username:", "Guest" + Math.floor(Math.random()*10000));
localStorage.setItem('username', username);

// Render the main React component
ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(CorkBoard, { username: username }));
