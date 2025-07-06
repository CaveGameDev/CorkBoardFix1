// utils.js

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function getClientCoords(event, touchIndex = 0) {
    if (event.touches && event.touches.length > 0) {
        return {
            x: event.touches[touchIndex].clientX,
            y: event.touches[touchIndex].clientY
        };
    }
    return {
        x: event.clientX,
        y: event.clientY
    };
}

function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function getMidpoint(p1, p2) {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
    };
}

async function waitForAllMediaToLoad(element) {
    const mediaElements = Array.from(element.querySelectorAll('img, video'));
    const promises = mediaElements.map(media => {
        if (media.complete || media.readyState >= 3) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            media.onload = () => resolve();
            media.onerror = () => resolve(); // Resolve even on error to not block
        });
    });
    await Promise.all(promises);
}

function isSuspiciousLink(text) {
    const suspiciousDomains = ['tiny.cc', 'bit.ly']; // Add more as needed
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex);
        if (matches) {
            for (const urlString of matches) {
                const url = new URL(urlString);
                if (suspiciousDomains.some(domain => url.hostname.includes(domain))) {
                    return true;
                }
            }
        }
    } catch (e) {
        console.warn("Error parsing link for suspicion check:", e);
    }
    return false;
}

// Function to generate emoji using AI
async function generateEmoji(expression) {
    try {
        const response = await fetch('https://emojigen.org/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ expression: expression })
        });
        const data = await response.json();
        if (response.ok && data.emoji) {
            return data.emoji;
        } else {
            console.error("AI Emoji generation failed:", data.message || "Unknown error");
            throw new Error(data.message || "Failed to generate emoji");
        }
    } catch (error) {
        console.error("Network or AI service error during emoji generation:", error);
        throw error;
    }
}

async function replaceEmojiCommands(text) {
    const AI_EMOJI_COMMAND_PATTERN = /!emoji\s+([^!\s]+)/g; // Matches !emoji followed by one or more non-space, non-! characters
    let newText = text;
    let match;
    const promises = [];
    while ((match = AI_EMOJI_COMMAND_PATTERN.exec(text)) !== null) {
        const fullCommand = match[0];
        const expression = match[1];
        promises.push(generateEmoji(expression).then(emoji => ({ fullCommand, emoji })));
    }

    const results = await Promise.all(promises);
    for (const { fullCommand, emoji } of results) {
        newText = newText.replace(fullCommand, emoji);
    }
    return newText;
}

function renderTextWithLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return {
        __html: parts.map(part => {
            if (part.match(urlRegex)) {
                return `<a href="${part}" target="_blank" rel="noopener noreferrer">${part}</a>`;
            }
            return part;
        }).join('')
    };
}
