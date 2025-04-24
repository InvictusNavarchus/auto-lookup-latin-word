// ==UserScript==
// @name         Auto Lookup Latin Word
// @namespace    https://github.com/InvictusNavarchus
// @version      0.2.3
// @description  Automatically lookup Latin words on hover and display their meanings
// @author       Invictus
// @match        https://la.wikipedia.org/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @downloadURL  https://raw.githubusercontent.com/InvictusNavarchus/auto-lookup-latin-word/master/auto-lookup-latin-word.user.js
// @updateURL    https://raw.githubusercontent.com/InvictusNavarchus/auto-lookup-latin-word/master/auto-lookup-latin-word.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ====================================
    // Logging System
    // ====================================
    const Logger = {
        levels: {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        },
        currentLevel: 1, // Default to INFO level
        
        formatMessage: function(level, message) {
            const timestamp = new Date().toISOString();
            return `[LATIN-LOOKUP][${timestamp}][${level}] ${message}`;
        },
        
        debug: function(message) {
            if (this.currentLevel <= this.levels.DEBUG) {
                console.debug(this.formatMessage('DEBUG', message));
            }
        },
        
        info: function(message) {
            if (this.currentLevel <= this.levels.INFO) {
                console.info(this.formatMessage('INFO', message));
            }
        },
        
        warn: function(message) {
            if (this.currentLevel <= this.levels.WARN) {
                console.warn(this.formatMessage('WARN', message));
            }
        },
        
        error: function(message) {
            if (this.currentLevel <= this.levels.ERROR) {
                console.error(this.formatMessage('ERROR', message));
            }
        },
        
        setLevel: function(level) {
            this.currentLevel = level;
            this.info(`Log level set to ${Object.keys(this.levels).find(key => this.levels[key] === level)}`);
        }
    };

    // ====================================
    // API Service
    // ====================================
    const LatinAPI = {
        baseUrl: 'https://latin-words.com/cgi-bin/translate.cgi',
        
        lookupWord: function(word) {
            Logger.debug(`Looking up word: ${word}`);
            
            const url = `${this.baseUrl}?query=${encodeURIComponent(word)}`;
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    headers: {
                        "Host": "latin-words.com",
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
                        "Accept": "*/*",
                        "Accept-Language": "en-US,en;q=0.5",
                        "Accept-Encoding": "gzip, deflate, br, zstd",
                        "X-Requested-With": "XMLHttpRequest",
                        "DNT": "1",
                        "Connection": "keep-alive",
                        "Referer": "https://latin-words.com/"
                    },
                    onload: function(response) {
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const data = JSON.parse(response.responseText);
                                Logger.debug(`API response received for "${word}"`);
                                resolve(data);
                            } catch (e) {
                                Logger.error(`Failed to parse API response for "${word}": ${e}`);
                                reject(new Error("Invalid JSON response"));
                            }
                        } else {
                            Logger.error(`API request failed for "${word}" with status: ${response.status}`);
                            reject(new Error(`HTTP error! Status: ${response.status}`));
                        }
                    },
                    onerror: function(error) {
                        Logger.error(`API request failed for "${word}": ${error}`);
                        reject(error);
                    }
                });
            });
        }
    };

    // ====================================
    // Response Parser
    // ====================================
    const ResponseParser = {
        parse: function(response) {
            if (response.status !== "ok" || !response.message) {
                Logger.warn("Invalid response format or error status");
                return { error: "Invalid response" };
            }

            const lines = response.message.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length < 2) {
                Logger.warn("Response doesn't contain enough information");
                return { error: "Insufficient data" };
            }

            // Try to parse grammatical form from first line
            const grammaticalInfo = lines[0].trim();
            
            // Extract dictionary form and part of speech from second line
            const dictionaryLine = lines[1].trim();
            const partOfSpeech = this.extractPartOfSpeech(dictionaryLine);
            const dictionaryForm = this.extractDictionaryForm(dictionaryLine);
            
            // Get definitions from remaining lines
            const definitions = lines.slice(2).join('\n').trim()
                .split(';')
                .map(def => def.trim())
                .filter(def => def && !def.startsWith('*') && !def.startsWith('='));
            
            return {
                word: dictionaryForm,
                partOfSpeech,
                grammaticalInfo,
                definitions
            };
        },
        
        extractPartOfSpeech: function(line) {
            const posMatches = line.match(/\b(ADJ|N|V|ADV|PREP|CONJ|INTERJ)\b(\s+\(\d+\w+\))?/);
            return posMatches ? posMatches[0] : 'Unknown';
        },
        
        extractDictionaryForm: function(line) {
            // Extract the main dictionary form before any parts of speech
            const mainForm = line.split(/\s+[A-Z]/).shift().trim();
            return mainForm;
        }
    };

    // ====================================
    // UI Components
    // ====================================
    const UI = {
        enabled: true,
        tooltip: null,
        toggleButton: null,
        
        init: function() {
            this.createToggleButton();
            this.createTooltip();
            Logger.info("UI components initialized");
        },
        
        createToggleButton: function() {
            const button = document.createElement('div');
            button.id = 'latin-lookup-toggle';
            button.textContent = 'L';
            button.title = 'Toggle Latin word lookup';
            button.className = 'latin-lookup-enabled';
            
            button.addEventListener('click', () => {
                this.enabled = !this.enabled;
                button.className = this.enabled ? 'latin-lookup-enabled' : 'latin-lookup-disabled';
                Logger.info(`Latin lookup ${this.enabled ? 'enabled' : 'disabled'}`);
            });
            
            document.body.appendChild(button);
            this.toggleButton = button;
        },
        
        createTooltip: function() {
            const tooltip = document.createElement('div');
            tooltip.id = 'latin-lookup-tooltip';
            tooltip.style.display = 'none';
            document.body.appendChild(tooltip);
            this.tooltip = tooltip;
        },
        
        showTooltip: function(x, y, content) {
            if (!this.enabled) return;
            
            this.tooltip.innerHTML = content;
            
            // Position tooltip near cursor but ensure it stays within viewport
            const rect = this.tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Adjust position to keep tooltip within viewport
            let posX = x + 15;
            let posY = y + 15;
            
            if (posX + rect.width > viewportWidth) {
                posX = x - rect.width - 15;
            }
            
            if (posY + rect.height > viewportHeight) {
                posY = y - rect.height - 15;
            }
            
            this.tooltip.style.left = `${posX}px`;
            this.tooltip.style.top = `${posY}px`;
            this.tooltip.style.display = 'block';
        },
        
        hideTooltip: function() {
            this.tooltip.style.display = 'none';
        },
        
        formatWordInfo: function(wordInfo) {
            if (wordInfo.error) {
                return `<div class="latin-lookup-error">${wordInfo.error}</div>`;
            }
            
            let html = `
                <div class="latin-lookup-header">
                    <span class="latin-lookup-word">${wordInfo.word}</span>
                    <span class="latin-lookup-pos">${wordInfo.partOfSpeech}</span>
                </div>
                <div class="latin-lookup-grammar">${wordInfo.grammaticalInfo}</div>
                <div class="latin-lookup-definitions">
            `;
            
            if (wordInfo.definitions && wordInfo.definitions.length > 0) {
                html += '<ul>';
                wordInfo.definitions.forEach(def => {
                    html += `<li>${def}</li>`;
                });
                html += '</ul>';
            } else {
                html += '<p>No definitions found</p>';
            }
            
            html += '</div>';
            return html;
        }
    };

    // ====================================
    // Word Lookup Handler
    // ====================================
    const WordLookup = {
        hoverDelay: 500,  // Delay in ms
        hoverTimer: null,
        lastWord: '',
        cache: {},  // Simple cache to avoid repeated lookups
        
        init: function() {
            this.setupEventListeners();
            Logger.info("Word lookup handler initialized");
        },
        
        setupEventListeners: function() {
            document.addEventListener('mousemove', this.handleMouseMove.bind(this));
            document.addEventListener('mouseout', () => {
                UI.hideTooltip();
                this.clearHoverTimer();
            });
        },
        
        handleMouseMove: function(event) {
            if (!UI.enabled) return;
            
            const target = event.target;
            
            // Skip if hovering over our own UI elements
            if (target.id === 'latin-lookup-tooltip' || target.id === 'latin-lookup-toggle' ||
                target.closest('#latin-lookup-tooltip') || target.closest('#latin-lookup-toggle')) {
                return;
            }
            
            // Check if the element or its parent contains text
            if (this.isTextNode(target) || this.hasTextChild(target)) {
                const word = this.getWordAtPoint(event.clientX, event.clientY);
                
                if (word && word.length > 1 && this.isLatinWord(word)) {
                    if (word !== this.lastWord) {
                        this.lastWord = word;
                        this.clearHoverTimer();
                        
                        this.hoverTimer = setTimeout(() => {
                            this.lookupWord(word, event.clientX, event.clientY);
                        }, this.hoverDelay);
                    }
                } else {
                    UI.hideTooltip();
                    this.clearHoverTimer();
                    this.lastWord = '';
                }
            }
        },
        
        getWordAtPoint: function(x, y) {
            const element = document.elementFromPoint(x, y);
            if (!element) return null;
            
            // Cross-browser compatibility for getting text at point
            let range, textNode, offset;
            
            // Chrome/Safari support
            if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(x, y);
                if (!range) return null;
                textNode = range.startContainer;
                offset = range.startOffset;
            } 
            // Firefox support
            else if (document.caretPositionFromPoint) {
                const position = document.caretPositionFromPoint(x, y);
                if (!position) return null;
                textNode = position.offsetNode;
                offset = position.offset;
            }
            
            // If we couldn't get a position, or the node isn't a text node, return null
            if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;
            
            try {
                const text = textNode.textContent;
                
                // Find word boundaries
                let startPos = this.findWordStart(text, offset);
                let endPos = this.findWordEnd(text, offset);
                
                // Extract the word
                const word = text.substring(startPos, endPos).trim();
                return word;
            } catch (e) {
                Logger.error(`Error getting word at point: ${e}`);
                return null;
            }
        },
        
        findWordStart: function(text, offset) {
            // Move backward until we find a non-word character or beginning of string
            let pos = offset;
            while (pos > 0 && this.isWordChar(text.charAt(pos - 1))) {
                pos--;
            }
            return pos;
        },
        
        findWordEnd: function(text, offset) {
            // Move forward until we find a non-word character or end of string
            let pos = offset;
            while (pos < text.length && this.isWordChar(text.charAt(pos))) {
                pos++;
            }
            return pos;
        },
        
        isWordChar: function(char) {
            // Check if character is a letter (for Latin words)
            return /[a-zA-Z]/.test(char);
        },
        
        isTextNode: function(node) {
            return node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0;
        },
        
        hasTextChild: function(element) {
            if (!element || !element.childNodes) return false;
            
            for (let i = 0; i < element.childNodes.length; i++) {
                const node = element.childNodes[i];
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
                    return true;
                }
            }
            
            return false;
        },
        
        isLatinWord: function(word) {
            // Basic check for Latin words - allowing only Latin alphabet letters
            // Excluding common English words would be better but requires a dictionary
            return /^[a-zA-Z]+$/.test(word) && word.length >= 2;
        },
        
        lookupWord: function(word, x, y) {
            Logger.debug(`Looking up word: ${word}`);
            
            // Check cache first
            if (this.cache[word]) {
                Logger.debug(`Using cached result for "${word}"`);
                UI.showTooltip(x, y, UI.formatWordInfo(this.cache[word]));
                return;
            }
            
            // Show loading state
            UI.showTooltip(x, y, '<div class="latin-lookup-loading">Looking up word...</div>');
            
            LatinAPI.lookupWord(word)
                .then(response => {
                    const wordInfo = ResponseParser.parse(response);
                    this.cache[word] = wordInfo; // Cache the result
                    UI.showTooltip(x, y, UI.formatWordInfo(wordInfo));
                })
                .catch(error => {
                    Logger.error(`Failed to lookup word "${word}": ${error}`);
                    UI.showTooltip(x, y, '<div class="latin-lookup-error">Failed to lookup word</div>');
                });
        },
        
        clearHoverTimer: function() {
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
                this.hoverTimer = null;
            }
        }
    };

    // ====================================
    // Styles
    // ====================================
    function addStyles() {
        const css = `
            #latin-lookup-tooltip {
                position: absolute;
                z-index: 10000;
                background-color: #fff;
                border-radius: 6px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                padding: 12px;
                max-width: 350px;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                font-size: 14px;
                line-height: 1.4;
                color: #333;
                transition: opacity 0.2s ease-in-out;
                border-left: 4px solid #5a67d8;
            }
            
            #latin-lookup-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-weight: bold;
                font-size: 18px;
                z-index: 10001;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                transition: all 0.2s ease;
            }
            
            .latin-lookup-enabled {
                background-color: #5a67d8;
                color: #fff;
            }
            
            .latin-lookup-disabled {
                background-color: #d1d5db;
                color: #6b7280;
            }
            
            .latin-lookup-header {
                margin-bottom: 8px;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 5px;
            }
            
            .latin-lookup-word {
                font-weight: bold;
                font-size: 16px;
                color: #4c51bf;
            }
            
            .latin-lookup-pos {
                font-style: italic;
                color: #6b7280;
                margin-left: 8px;
            }
            
            .latin-lookup-grammar {
                font-size: 12px;
                color: #6b7280;
                margin-bottom: 8px;
            }
            
            .latin-lookup-definitions ul {
                margin: 0;
                padding-left: 20px;
            }
            
            .latin-lookup-definitions li {
                margin-bottom: 4px;
            }
            
            .latin-lookup-loading {
                font-style: italic;
                color: #6b7280;
            }
            
            .latin-lookup-error {
                color: #e53e3e;
            }
            
            #latin-lookup-toggle:hover {
                transform: scale(1.1);
            }
        `;
        
        GM_addStyle(css);
        Logger.debug("Styles added");
    }

    // ====================================
    // Initialization
    // ====================================
    function initialize() {
        Logger.info("Initializing Latin Word Lookup");
        addStyles();
        UI.init();
        WordLookup.init();
    }

    // Wait for the page to fully load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
