// ==UserScript==
// @name         Auto Lookup Latin Word
// @namespace    https://github.com/InvictusNavarchus
// @version      0.2.5
// @description  Automatically lookup Latin words on hover and display their meanings
// @author       Invictus
// @match        https://la.wikipedia.org/*
// @connect      latin-words.com
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @downloadURL  https://raw.githubusercontent.com/InvictusNavarchus/auto-lookup-latin-word/master/auto-lookup-latin-word.user.js
// @updateURL    https://raw.githubusercontent.com/InvictusNavarchus/auto-lookup-latin-word/master/auto-lookup-latin-word.user.js
// ==/UserScript==

(function () {
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

        formatMessage: function (level, message) {
            const timestamp = new Date().toISOString();
            return `[LATIN-LOOKUP][${timestamp}][${level}] ${message}`;
        },

        debug: function (message) {
            if (this.currentLevel <= this.levels.DEBUG) {
                console.debug(this.formatMessage('DEBUG', message));
            }
        },

        info: function (message) {
            if (this.currentLevel <= this.levels.INFO) {
                console.info(this.formatMessage('INFO', message));
            }
        },

        warn: function (message) {
            if (this.currentLevel <= this.levels.WARN) {
                console.warn(this.formatMessage('WARN', message));
            }
        },

        error: function (message) {
            if (this.currentLevel <= this.levels.ERROR) {
                console.error(this.formatMessage('ERROR', message));
            }
        },

        setLevel: function (level) {
            this.currentLevel = level;
            this.info(`Log level set to ${Object.keys(this.levels).find(key => this.levels[key] === level)}`);
        }
    };

    // ====================================
    // API Service
    // ====================================
    const LatinAPI = {
        baseUrl: 'https://latin-words.com/cgi-bin/translate.cgi',

        lookupWord: function (word) {
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
                    onload: function (response) {
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
                    onerror: function (error) {
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
        parse: function (response) {
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

        extractPartOfSpeech: function (line) {
            const posMatches = line.match(/\b(ADJ|N|V|ADV|PREP|CONJ|INTERJ)\b(\s+\(\d+\w+\))?/);
            return posMatches ? posMatches[0] : 'Unknown';
        },

        extractDictionaryForm: function (line) {
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

        init: function () {
            this.createToggleButton();
            this.createTooltip();
            Logger.info("UI components initialized");
        },

        createToggleButton: function () {
            const button = document.createElement('div');
            button.id = 'latin-lookup-toggle';
            button.textContent = 'L';
            button.title = 'Toggle Latin word lookup';
            button.className = 'latin-lookup-enabled';

            button.addEventListener('click', () => {
                this.enabled = !this.enabled;
                button.className = this.enabled ? 'latin-lookup-enabled' : 'latin-lookup-disabled';
                Logger.info(`Latin lookup ${this.enabled ? 'enabled' : 'disabled'}`);
                // Hide tooltip immediately if disabled
                if (!this.enabled) {
                    this.hideTooltip();
                }
            });

            document.body.appendChild(button);
            this.toggleButton = button;
        },

        createTooltip: function () {
            const tooltip = document.createElement('div');
            tooltip.id = 'latin-lookup-tooltip';
            tooltip.style.display = 'none'; // Start hidden
            tooltip.style.position = 'absolute'; // Ensure position is absolute
            tooltip.style.zIndex = '10000'; // Ensure it's on top
            document.body.appendChild(tooltip);
            this.tooltip = tooltip;
        },

        showTooltip: function (pageX, pageY, clientX, clientY, content) { // <<<< MODIFIED SIGNATURE
            if (!this.enabled) return;

            this.tooltip.innerHTML = content;
            // Make it visible *before* getting bounds, helps ensure dimensions are calculated
            this.tooltip.style.display = 'block';
            // Temporarily position off-screen to measure without visual glitch
            this.tooltip.style.left = '-9999px';
            this.tooltip.style.top = '-9999px';


            // Force reflow/recalculation if needed (often implicit, but can help)
            this.tooltip.offsetHeight; // Read a dimension property

            // Get dimensions and viewport size
            const rect = this.tooltip.getBoundingClientRect(); // Dimensions relative to viewport
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Initial position based on document coordinates (pageX, pageY)
            let posX = pageX + 15;
            let posY = pageY + 15;

            // Adjust position to keep tooltip within viewport boundaries
            // Use clientX/Y for viewport checks

            // Check right edge (using clientX)
            if (clientX + 15 + rect.width > viewportWidth) {
                // If it overflows right, position it to the left of the cursor (using pageX)
                posX = pageX - rect.width - 15;
            }

            // Check bottom edge (using clientY)
            if (clientY + 15 + rect.height > viewportHeight) {
                // If it overflows bottom, position it above the cursor (using pageY)
                posY = pageY - rect.height - 15;
            }

            // Ensure tooltip doesn't go off the top or left of the *document*
            if (posX < 0) posX = 0;
            if (posY < window.scrollY) posY = window.scrollY; // Adjust if needed based on scroll

            // Apply the final calculated position
            this.tooltip.style.left = `${posX}px`;
            this.tooltip.style.top = `${posY}px`;

            // Ensure display is 'block' (it should be already, but belts and suspenders)
            this.tooltip.style.display = 'block';
        }, // <<<< END OF MODIFIED showTooltip

        hideTooltip: function () {
            if (this.tooltip) { // Check if tooltip exists
                this.tooltip.style.display = 'none';
            }
        },

        formatWordInfo: function (wordInfo) {
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

        init: function () {
            this.setupEventListeners();
            Logger.info("Word lookup handler initialized");
        },

        setupEventListeners: function () {
            document.addEventListener('mousemove', this.handleMouseMove.bind(this));
            // Use mouseleave on the document body for better detection when mouse exits window
            document.body.addEventListener('mouseleave', () => {
                UI.hideTooltip();
                this.clearHoverTimer();
                this.lastWord = ''; // Reset lastWord when mouse leaves body
            });
            // Add scroll listener to hide tooltip on scroll (optional, but good UX)
            document.addEventListener('scroll', () => {
                UI.hideTooltip();
                this.clearHoverTimer();
            }, true); // Use capture phase for scroll
        },

        handleMouseMove: function (event) { // <<<< MODIFIED handleMouseMove
            if (!UI.enabled) return;

            const target = event.target;

            // Skip if hovering over our own UI elements
            if (target.id === 'latin-lookup-tooltip' || target.id === 'latin-lookup-toggle' ||
                target.closest('#latin-lookup-tooltip') || target.closest('#latin-lookup-toggle')) {
                // Optionally clear timer if mouse moves onto tooltip from text
                // this.clearHoverTimer();
                return;
            }

            // Check if the element or its parent contains text
            // Use elementFromPoint for more reliable target checking under the cursor
            const elementUnderCursor = document.elementFromPoint(event.clientX, event.clientY);
            if (elementUnderCursor && (this.isTextNode(elementUnderCursor) || this.hasTextChild(elementUnderCursor) || (elementUnderCursor.nodeType === Node.ELEMENT_NODE && elementUnderCursor.textContent.trim().length > 0))) {
                const word = this.getWordAtPoint(event.clientX, event.clientY);

                if (word && word.length > 1 && this.isLatinWord(word)) {
                    // Check if the word actually changed OR if the mouse moved significantly
                    // This prevents flickering if the mouse jitters slightly over the same word
                    if (word !== this.lastWord) {
                        this.lastWord = word;
                        this.clearHoverTimer();

                        this.hoverTimer = setTimeout(() => {
                            // Pass all relevant coordinates: pageX/Y for positioning, clientX/Y for viewport checks
                            this.lookupWord(word, event.pageX, event.pageY, event.clientX, event.clientY);
                        }, this.hoverDelay);
                    }
                    // If it's the same word, do nothing, let existing timer run or tooltip stay visible
                } else {
                    // Mouse is over text, but not a valid Latin word or word detection failed
                    UI.hideTooltip();
                    this.clearHoverTimer();
                    this.lastWord = '';
                }
            } else {
                // Mouse is not over a text node or an element containing text
                UI.hideTooltip();
                this.clearHoverTimer();
                this.lastWord = '';
            }
        }, // <<<< END OF MODIFIED handleMouseMove

        getWordAtPoint: function (x, y) {
            // Use try-catch as caretPositionFromPoint can sometimes throw errors
            try {
                const element = document.elementFromPoint(x, y);
                if (!element) return null;

                let range, textNode, offset;

                // Prioritize caretPositionFromPoint (Firefox) if available and reliable
                if (document.caretPositionFromPoint) {
                    const position = document.caretPositionFromPoint(x, y);
                    if (position) {
                        textNode = position.offsetNode;
                        offset = position.offset;
                    }
                }
                // Fallback to caretRangeFromPoint (Chrome/Safari/Edge)
                else if (document.caretRangeFromPoint) {
                    range = document.caretRangeFromPoint(x, y);
                    if (range) {
                        textNode = range.startContainer;
                        offset = range.startOffset;
                    }
                }

                // If we couldn't get a position, or the node isn't a text node, try a fallback
                if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
                    // Fallback: If the element itself has text content directly
                    if (element.textContent && element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
                        textNode = element.childNodes[0];
                        // Estimate offset - might not be perfect but better than nothing
                        offset = Math.floor(textNode.textContent.length / 2);
                    } else {
                        return null; // Give up if no suitable text node found
                    }
                }


                const text = textNode.textContent;

                // Check if offset is valid
                if (offset < 0 || offset > text.length) {
                    // If offset is invalid (can happen at edges), try middle of text node
                    offset = Math.floor(text.length / 2);
                }

                // Find word boundaries
                let startPos = this.findWordStart(text, offset);
                let endPos = this.findWordEnd(text, offset);

                // Extract the word
                const word = text.substring(startPos, endPos).trim();
                // Basic sanity check
                if (word.length > 0 && word.length < 50) { // Avoid excessively long "words"
                    return word;
                } else {
                    return null;
                }

            } catch (e) {
                Logger.error(`Error getting word at point: ${e}`);
                return null;
            }
        },

        findWordStart: function (text, offset) {
            // Adjust offset if it's precisely at the start of a word char following a non-word char
            if (offset > 0 && !this.isWordChar(text.charAt(offset - 1)) && this.isWordChar(text.charAt(offset))) {
                // No change needed, offset is good
            } else {
                // Otherwise, move offset back one to ensure we are *within* the potential word
                offset = Math.max(0, offset - 1);
            }

            // Move backward until we find a non-word character or beginning of string
            let pos = offset;
            while (pos >= 0 && this.isWordChar(text.charAt(pos))) {
                pos--;
            }
            // The start position is one character after the non-word character (or 0)
            return pos + 1;
        },

        findWordEnd: function (text, offset) {
            // Ensure offset is within bounds
            offset = Math.max(0, Math.min(offset, text.length - 1));

            // Move forward until we find a non-word character or end of string
            let pos = offset;
            while (pos < text.length && this.isWordChar(text.charAt(pos))) {
                pos++;
            }
            return pos;
        },

        isWordChar: function (char) {
            // Check if character is a Latin alphabet letter (case-insensitive)
            // Allows only a-z and A-Z. Modify if macrons (āēīōū) etc. are needed.
            return /[a-zA-Z]/.test(char);
        },

        isTextNode: function (node) {
            return node && node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0;
        },

        hasTextChild: function (element) {
            if (!element || !element.childNodes) return false;

            for (let i = 0; i < element.childNodes.length; i++) {
                const node = element.childNodes[i];
                if (this.isTextNode(node)) {
                    return true;
                }
                // Optionally, recurse into child elements, but be careful performance-wise
                // if (node.nodeType === Node.ELEMENT_NODE && this.hasTextChild(node)) {
                //     return true;
                // }
            }

            return false;
        },

        isLatinWord: function (word) {
            // Basic check: 2+ Latin letters only.
            // Consider adding checks against common English words if needed later.
            return /^[a-zA-Z]{2,}$/.test(word);
        },

        lookupWord: function (word, pageX, pageY, clientX, clientY) { // <<<< MODIFIED SIGNATURE
            Logger.debug(`Looking up word: ${word} at doc(${pageX}, ${pageY}), view(${clientX}, ${clientY})`);

            // Check cache first
            if (this.cache[word]) {
                Logger.debug(`Using cached result for "${word}"`);
                // Pass all coordinates to showTooltip
                UI.showTooltip(pageX, pageY, clientX, clientY, UI.formatWordInfo(this.cache[word]));
                return;
            }

            // Show loading state (pass all coordinates)
            UI.showTooltip(pageX, pageY, clientX, clientY, '<div class="latin-lookup-loading">Looking up word...</div>');

            LatinAPI.lookupWord(word)
                .then(response => {
                    // Check if the mouse is still over the same word before showing result
                    if (word === this.lastWord) {
                        const wordInfo = ResponseParser.parse(response);
                        this.cache[word] = wordInfo; // Cache the result
                        // Pass all coordinates to showTooltip
                        UI.showTooltip(pageX, pageY, clientX, clientY, UI.formatWordInfo(wordInfo));
                    } else {
                        Logger.debug(`Word changed before API response for "${word}" arrived.`);
                        // Optional: hide loading tooltip if it's still showing
                        // UI.hideTooltip();
                    }
                })
                .catch(error => {
                    Logger.error(`Failed to lookup word "${word}": ${error}`);
                    // Check if the mouse is still over the same word before showing error
                    if (word === this.lastWord) {
                        // Pass all coordinates to showTooltip
                        UI.showTooltip(pageX, pageY, clientX, clientY, '<div class="latin-lookup-error">Failed to lookup word</div>');
                    }
                });
        }, // <<<< END OF MODIFIED lookupWord

        clearHoverTimer: function () {
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
        // Tooltip styles remain the same, but added position/z-index explicitly here
        // just in case they weren't already set in createTooltip (redundancy is fine).
        const css = `
            #latin-lookup-tooltip {
                /* position: absolute; */ /* Already set in createTooltip */
                /* z-index: 10000; */   /* Already set in createTooltip */
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
                /* Ensure pointer events don't interfere with underlying text selection */
                pointer-events: none;
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
                user-select: none; /* Prevent selecting the 'L' */
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
                font-weight: bold;
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
        Logger.info("Latin Word Lookup Initialized Successfully");
    }

    // Wait for the page to fully load before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOMContentLoaded has already fired
        initialize();
    }

})();