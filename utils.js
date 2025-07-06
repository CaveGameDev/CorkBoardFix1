// utils.js
export const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`;

export const shuffleArray = (array) => {
    let newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

export const getClientCoords = (e, index = 0) => {
    if (e.touches && e.touches.length > index) {
        return { x: e.touches[index].clientX, y: e.touches[index].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > index) {
        return { x: e.changedTouches[index].clientX, y: e.changedTouches[index].clientY };
    }
    return { x: e.clientX, y: e.clientY };
};

export const getDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
export const getMidpoint = (p1, p2) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });

export const waitForAllMediaToLoad = (element) => {
    return new Promise(resolve => {
        const mediaElements = Array.from(element.querySelectorAll('img, video'));
        if (mediaElements.length === 0) {
            resolve();
            return;
        }

        let loadedCount = 0;
        const totalMedia = mediaElements.length;

        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount === totalMedia) {
                resolve();
            }
        };

        mediaElements.forEach(media => {
            if (media.tagName === 'IMG') {
                if (media.complete && media.naturalHeight !== 0) { 
                    checkLoaded();
                } else {
                    media.onload = checkLoaded;
                    media.onerror = (e) => {
                        console.warn('Image failed to load in archive capture:', media.src, e);
                        checkLoaded(); 
                    };
                }
            } else if (media.tagName === 'VIDEO') {
                if (media.readyState >= 3) { 
                    checkLoaded();
                } else {
                    media.onloadedmetadata = checkLoaded;
                    media.onerror = (e) => {
                        console.warn('Video failed to load in archive capture:', media.src, e);
                        checkLoaded(); 
                    };
                }
            }
        });
    });
};

export const isSuspiciousLink = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    try {
      const url = new URL(match[0]);
      const hostname = url.hostname;
      if (hostname.includes('tiny.cc') || hostname.includes('bit.ly') || hostname.includes('bitly.com')) {
        return true; 
      }
    } catch (e) {
      console.warn("Invalid URL detected during scan:", match[0], e);
    }
  }
  return false; 
};

// Placeholder for generateEmoji - in a real app, this would be an API call
// or a more complex generation logic. The original HTML implied its existence.
export const generateEmoji = async (expression) => {
  console.log(`Generating emoji for: ${expression}`);
  // Simulate an async AI call
  await new Promise(resolve => setTimeout(resolve, 500)); 
  const emojis = {
    'happy': '😊', 'sad': '😔', 'angry': '😠', 'love': '❤️', 'surprise': '😲',
    'idea': '💡', 'thinking': '🤔', 'robot': '🤖', 'cat': '🐱', 'dog': '🐶'
  };
  return emojis[expression.toLowerCase()] || `[${expression}]`;
};

export const replaceEmojiCommands = async (text) => {
  const emojiCommandRegex = /!emoji\s+(.+?)(?=\s!emoji|$)/g; // Non-greedy to allow multiple in one string
  let originalOrderMatches = [];
  
  // Find all matches first to avoid issues with string manipulation during async operations
  let match;
  while ((match = emojiCommandRegex.exec(text)) !== null) {
      originalOrderMatches.push({ 
          fullMatch: match[0], 
          expression: match[1].trim(), 
          index: match.index 
      });
  }

  if (originalOrderMatches.length === 0) {
      return text; 
  }

  const emojiPromises = originalOrderMatches.map(m => generateEmoji(m.expression));
  const generatedEmojis = await Promise.all(emojiPromises);

  let resultText = text;
  // Replace from end to start to avoid index issues
  for (let i = originalOrderMatches.length - 1; i >= 0; i--) {
      const m = originalOrderMatches[i];
      const emoji = generatedEmojis[i]; 
      resultText = resultText.substring(0, m.index) + emoji + resultText.substring(m.index + m.fullMatch.length);
  }
  return resultText;
};

export const renderTextWithLinks = (text) => {
  if (typeof text !== 'string' || text === null || text === undefined) {
    return { __html: '' }; 
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const startIndex = match.index;
    const endIndex = urlRegex.lastIndex;

    if (startIndex > lastIndex) {
      parts.push(text.substring(lastIndex, startIndex));
    }

    parts.push(
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
    lastIndex = endIndex;
  }

  if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
  }

  return { __html: parts.join('') };
};