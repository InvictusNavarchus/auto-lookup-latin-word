// ==UserScript==
// @name         Auto Lookup Latin Word
// @namespace    https://github.com/InvictusNavarchus
// @version      0.3.1
// @description  Automatically lookup Latin words on text selection and display their meanings
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
    // Script Configuration
    // ====================================
    const config = {
        // No longer need hover delay for selection-based lookup
    }
    
    // ====================================
    // Logging System (Keep as is)
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
    // Logger.setLevel(Logger.levels.DEBUG); // Uncomment for detailed parsing logs

    // ====================================
    // API Service (Keep as is)
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
    // Response Parser (REVISED)
    // ====================================
    const ResponseParser = {
        // Regex Patterns for line identification
        patterns: {
            // Matches lines describing the grammatical form of the *queried* word
            // e.g., "abund.ans   VPAR   1 1 NOM S X PRES ACTIVE  PPL"
            // e.g., "accept.ae   N      1 1 GEN S F"
            grammaticalInfo: /^([\w.]+)\s+([A-Z]+)\s+(.+)$/,

            // Matches the main dictionary entry line (lemma, POS, details)
            // e.g., "abundo, abundare, abundavi, abundatus  V (1st)  [XXXAO]"
            // e.g., "accepta, acceptae  N (1st) F  [XLXEO]    uncommon"
            // e.g., "ad   PREP  ACC  [XXXAO]"
            // e.g., "ad   ADV  [XXXCO]"
            // e.g., "alii   CONJ   [XXXCC]"
            // e.g., "ait, -, -  V IMPERS  [XXXAO]"
            // Captures: 1=lemma/principal parts, 2=POS, 3=details (decl/conj, freq, notes)
            dictionaryEntry: /^([\w\s\(\),āēīōūĀĒĪŌŪ-]+?)\s+(ADJ|N|V|ADV|PREP|CONJ|INTERJ|PRON|NUM|VPAR|TACKON|SUFFIX|PREFIX)\b(.*)$/,

            // Specific note lines
            unknown: /^\s*========\s+UNKNOWN\s*$/,
            twoWords: /^\s*Two words/,
            wordMod: /^\s*Word mod/,
            syncope: /^\s*Syncope/,
            prefix: /^\s*-\s*PREFIX\s*/, // Match PREFIX lines specifically if needed
            suffix: /^\s*-\s*SUFFIX\s*/, // Match SUFFIX lines specifically if needed

            // General noise/ignore lines
            ignoreLine: /^[\s\*=\-]+$/, // Ignore lines with only whitespace, '*', '=', or '-'
        },

        parse: function (response) {
            if (response.status !== "ok" || typeof response.message !== 'string') {
                Logger.warn("Invalid response format or error status");
                return { entries: [], grammaticalForms: [], notes: ["Invalid API response format"] };
            }

            const lines = response.message.split('\n');
            const result = {
                entries: [],          // Array of parsed dictionary entries
                grammaticalForms: [], // Array of grammatical analyses for the queried word
                notes: [],            // General notes about the response
                unknown: false        // Flag if the word is marked as UNKNOWN
            };

            let currentEntry = null;
            let definitionBuffer = [];

            const flushEntry = () => {
                if (currentEntry) {
                    // Process buffered definition lines
                    const rawDefinitions = definitionBuffer.join(' ').trim();
                    if (rawDefinitions) {
                        // Split by semicolon, but be mindful of potential semicolons within definitions
                        // A simple split is often good enough here, but could be smarter
                        currentEntry.definitions = rawDefinitions.split(';')
                            .map(def => def.trim())
                            .filter(def => def && !this.patterns.ignoreLine.test(def)); // Basic filter
                    }
                    result.entries.push(currentEntry);
                    Logger.debug(`Flushed entry: ${currentEntry.lemma}, Defs: ${currentEntry.definitions.length}`);
                }
                currentEntry = null;
                definitionBuffer = [];
            };

            for (const rawLine of lines) {
                const line = rawLine.replace(/\r$/, '').trim(); // Remove trailing \r and trim whitespace

                if (!line || this.patterns.ignoreLine.test(line)) {
                    continue; // Skip empty lines or lines with only separators/stars
                }

                Logger.debug(`Processing line: "${line}"`);

                // Check for specific note patterns first
                if (this.patterns.unknown.test(line)) {
                    Logger.debug("-> Matched UNKNOWN");
                    result.notes.push("Word not found in dictionary.");
                    result.unknown = true;
                    flushEntry(); // Finish any previous entry
                    continue; // Often nothing else useful follows UNKNOWN
                }
                if (this.patterns.twoWords.test(line)) {
                    Logger.debug("-> Matched Two Words");
                    result.notes.push("API suggests input might be two words.");
                    // Don't flush entry here, as info might follow
                    continue;
                }
                if (this.patterns.wordMod.test(line) || this.patterns.syncope.test(line)) {
                    Logger.debug("-> Matched Word Mod/Syncope");
                    // Add as note to current entry if available, otherwise general
                    const noteText = line; // Keep the full note
                    if (currentEntry) currentEntry.notes.push(noteText);
                    else result.notes.push(noteText);
                    continue;
                }

                // Attempt to match dictionary entry
                let match = line.match(this.patterns.dictionaryEntry);
                if (match) {
                    // Heuristic: If the "lemma" part contains typical grammatical codes like "NOM S F", it's probably grammatical info, not a dictionary entry.
                    const potentialLemma = match[1].trim();
                    const potentialPos = match[2];
                    const potentialDetails = match[3].trim();

                    // Avoid misinterpreting grammar lines as dictionary entries
                    // (e.g. "ab N 1 1 ABL S F" should not be treated as lemma "ab N 1 1 ABL S", POS "F")
                    // Crude check: If POS is a single letter (like F, M, N, X, C often found in grammar)
                    // AND the details look like more grammar codes (numbers, letters)
                    // treat it as grammar. This isn't perfect.
                    const looksLikeGrammar = /^[A-Z]$/.test(potentialPos) && /^\s*[\dA-Z\s]+/.test(potentialDetails);

                    if (!looksLikeGrammar) {
                        Logger.debug(`-> Matched Dictionary Entry: Lemma="${potentialLemma}", POS="${potentialPos}", Details="${potentialDetails}"`);
                        flushEntry(); // Flush the previous entry before starting a new one

                        currentEntry = {
                            lemma: potentialLemma,
                            pos: potentialPos,
                            details: potentialDetails,
                            notes: [], // Notes specific to this entry
                            definitions: []
                        };

                        // Extract frequency/usage notes from details
                        const detailParts = potentialDetails.split(/\s{2,}/); // Split by multiple spaces
                        const notes = detailParts.filter(part => /\[[A-Z]+\]|^\w+$/.test(part.trim())); // Look for [XXX] or single words like Late, uncommon
                        currentEntry.notes.push(...notes);
                        // Optionally clean up details string? For now, keep it raw.
                        // currentEntry.details = detailParts.filter(part => !notes.includes(part)).join(' ').trim();


                        // Special case: Sometimes definitions are on the same line for PREP, ADV, CONJ
                        if (['PREP', 'ADV', 'CONJ', 'TACKON'].includes(potentialPos)) {
                            const definitionPart = potentialDetails.replace(/\[.*?\]|\b(Late|Classic|Early|Medieval|NeoLatin|uncommon|veryrare|lesser|Pliny)\b/gi, '').trim();
                            if (definitionPart && definitionPart.length > 5) { // Heuristic: definition needs some length
                                definitionBuffer.push(definitionPart);
                                Logger.debug(`   -> Found inline definition: "${definitionPart}"`);
                            }
                        }
                        continue; // Move to the next line after identifying a dictionary entry
                    } else {
                        Logger.debug(`   -> Dictionary match rejected as likely grammar: "${line}"`);
                        // Fall through to check if it's grammatical info
                    }
                }

                // Attempt to match grammatical info line
                match = line.match(this.patterns.grammaticalInfo);
                if (match) {
                    Logger.debug(`-> Matched Grammatical Info: Word="${match[1]}", POS="${match[2]}", Codes="${match[3]}"`);
                    result.grammaticalForms.push({
                        inflectedForm: match[1],
                        pos: match[2],
                        codes: match[3].trim()
                    });
                    // Usually don't flush entry here, might relate to previous/next entry
                    continue;
                }

                // If it's none of the above, assume it's a definition line
                Logger.debug(`-> Matched Definition Line (default): "${line}"`);
                if (currentEntry) {
                    definitionBuffer.push(line);
                } else {
                    // Definition line found before any dictionary entry? Add as a general note.
                    result.notes.push(`Orphaned line: ${line}`);
                }
            }

            // Flush the last entry after the loop finishes
            flushEntry();

            // If no entries found but notes exist, keep the notes.
            if (result.entries.length === 0 && result.grammaticalForms.length === 0 && !result.unknown) {
                if (result.notes.length === 0) {
                    result.notes.push("No parseable information found.");
                }
                Logger.warn("Parsing resulted in no entries or grammatical forms.");
            } else if (result.entries.length === 0 && result.grammaticalForms.length === 0 && result.unknown) {
                // Already handled by the UNKNOWN note logic
            } else {
                Logger.info(`Parsing finished. Found ${result.entries.length} entries, ${result.grammaticalForms.length} grammar forms.`);
            }


            return result;
        }
    };

    // ====================================
    // UI Components
    // ====================================
    const UI = {
        enabled: true,
        tooltip: null,
        toggleButton: null,

        init: function () { // (Keep UI.init as is)
            this.createToggleButton();
            this.createTooltip();
            Logger.info("UI components initialized");
        },

        createToggleButton: function () { // (Keep createToggleButton as is)
            const button = document.createElement('div');
            button.id = 'latin-lookup-toggle';
            button.textContent = 'L';
            button.title = 'Toggle Latin word lookup on selection';
            button.className = 'latin-lookup-enabled';

            button.addEventListener('click', () => {
                this.enabled = !this.enabled;
                button.className = this.enabled ? 'latin-lookup-enabled' : 'latin-lookup-disabled';
                Logger.info(`Latin lookup ${this.enabled ? 'enabled' : 'disabled'}`);
                if (!this.enabled) {
                    this.hideTooltip();
                }
            });

            document.body.appendChild(button);
            this.toggleButton = button;
        },

        createTooltip: function () { // (Keep createTooltip as is)
            const tooltip = document.createElement('div');
            tooltip.id = 'latin-lookup-tooltip';
            tooltip.style.display = 'none';
            tooltip.style.position = 'absolute';
            tooltip.style.zIndex = '10000';
            document.body.appendChild(tooltip);
            this.tooltip = tooltip;
        },

        showTooltip: function (pageX, pageY, clientX, clientY, content) { // (Keep showTooltip as is)
            if (!this.enabled) return;

            this.tooltip.innerHTML = content;
            this.tooltip.style.display = 'block';
            this.tooltip.style.left = '-9999px';
            this.tooltip.style.top = '-9999px';

            this.tooltip.offsetHeight;

            const rect = this.tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let posX = pageX + 15;
            let posY = pageY + 15;

            if (clientX + 15 + rect.width > viewportWidth) {
                posX = pageX - rect.width - 15;
            }

            if (clientY + 15 + rect.height > viewportHeight) {
                posY = pageY - rect.height - 15;
            }

            if (posX < window.scrollX) posX = window.scrollX; // Adjust for horizontal scroll
            if (posY < window.scrollY) posY = window.scrollY; // Adjust for vertical scroll

            this.tooltip.style.left = `${posX}px`;
            this.tooltip.style.top = `${posY}px`;
            this.tooltip.style.display = 'block';
        },

        hideTooltip: function () { // (Keep hideTooltip as is)
            if (this.tooltip) {
                this.tooltip.style.display = 'none';
            }
        },

        // REVISED formatWordInfo
        formatWordInfo: function (parsedData) {
            if (!parsedData) {
                return `<div class="latin-lookup-error">Error parsing data</div>`;
            }

            // Handle cases where parsing found nothing useful or specific errors
            if (parsedData.entries.length === 0 && parsedData.grammaticalForms.length === 0) {
                let errorMsg = "No definition found.";
                if (parsedData.unknown) {
                    errorMsg = "Word not found in dictionary.";
                } else if (parsedData.notes.length > 0) {
                    // Display notes if they exist even without entries
                    errorMsg = parsedData.notes.join('<br>');
                }
                return `<div class="latin-lookup-error">${errorMsg}</div>`;
            }


            let html = '';

            // Display Grammatical Forms Found for the queried word
            if (parsedData.grammaticalForms && parsedData.grammaticalForms.length > 0) {
                html += '<div class="latin-lookup-grammar-section">';
                html += '<strong>Queried Form Analysis:</strong><ul>';
                parsedData.grammaticalForms.forEach(form => {
                    html += `<li><span class="latin-lookup-grammar-form">${form.inflectedForm}</span>: ${form.pos} ${form.codes}</li>`;
                });
                html += '</ul></div>';
            }

            // Display Dictionary Entries
            if (parsedData.entries && parsedData.entries.length > 0) {
                parsedData.entries.forEach((entry, index) => {
                    if (index > 0) {
                        html += '<hr class="latin-lookup-entry-separator">'; // Separator for multiple entries
                    }
                    html += `
                        <div class="latin-lookup-entry">
                            <div class="latin-lookup-header">
                                <span class="latin-lookup-word">${entry.lemma}</span>
                                <span class="latin-lookup-pos">${entry.pos || ''}</span>
                            </div>
                    `;
                    // Display entry-specific details/notes if any
                    if (entry.details || entry.notes.length > 0) {
                        html += `<div class="latin-lookup-entry-details">${entry.details || ''} ${entry.notes.join(' ')}</div>`;
                    }

                    // Display definitions
                    html += '<div class="latin-lookup-definitions">';
                    if (entry.definitions && entry.definitions.length > 0) {
                        html += '<ul>';
                        entry.definitions.forEach(def => {
                            // Basic sanitation - replace potential HTML tags just in case
                            const safeDef = def.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                            html += `<li>${safeDef}</li>`;
                        });
                        html += '</ul>';
                    } else {
                        html += '<p>No definitions provided for this entry.</p>';
                    }
                    html += '</div>'; // Close latin-lookup-definitions
                    html += '</div>'; // Close latin-lookup-entry
                });
            }

            // Display General Notes if any exist and haven't been shown elsewhere
            const generalNotesToShow = parsedData.notes.filter(note =>
                note !== "Word not found in dictionary." &&
                note !== "API suggests input might be two words." && // Example: decide which notes are general vs entry-specific
                !note.startsWith("Orphaned line:") // Don't show orphaned lines usually
            );
            if (generalNotesToShow.length > 0) {
                html += '<div class="latin-lookup-general-notes"><strong>Notes:</strong><br>' + generalNotesToShow.join('<br>') + '</div>';
            }


            return html || '<div class="latin-lookup-error">Could not format data.</div>'; // Fallback
        }
    };


    // ====================================
    // Word Lookup Handler (REVISED for selection-based lookup)
    // ====================================
    const WordLookup = {
        cache: {},

        /**
         * Initialize the selection-based word lookup system
         */
        init: function () {
            this.setupEventListeners();
            Logger.info("Selection-based word lookup handler initialized");
        },

        /**
         * Set up event listeners for text selection
         */
        setupEventListeners: function () {
            document.addEventListener('mouseup', this.handleTextSelection.bind(this));
            document.addEventListener('keyup', this.handleTextSelection.bind(this));
            
            // Hide tooltip when clicking elsewhere
            document.addEventListener('click', (event) => {
                if (!event.target.closest('#latin-lookup-tooltip') && 
                    !event.target.closest('#latin-lookup-toggle')) {
                    const selection = window.getSelection();
                    if (selection.rangeCount === 0 || selection.toString().trim() === '') {
                        UI.hideTooltip();
                    }
                }
            });
        },

        /**
         * Handle text selection events (mouseup, keyup)
         */
        handleTextSelection: function (event) {
            if (!UI.enabled) return;

            // Ignore events on our UI elements
            if (event.target.closest('#latin-lookup-tooltip') || 
                event.target.closest('#latin-lookup-toggle')) {
                return;
            }

            setTimeout(() => {
                this.processSelection(event);
            }, 10); // Small delay to ensure selection is finalized
        },

        /**
         * Process the current text selection
         */
        processSelection: function (event = null) {
            const selection = window.getSelection();
            
            if (selection.rangeCount === 0) {
                UI.hideTooltip();
                return;
            }

            const selectedText = selection.toString().trim();
            
            if (!selectedText) {
                UI.hideTooltip();
                return;
            }

            // Extract a single Latin word from the selection
            const word = this.extractLatinWord(selectedText);
            
            if (word) {
                // Get position for tooltip
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                // Calculate page coordinates from client coordinates
                const pageX = rect.left + window.scrollX;
                const pageY = rect.bottom + window.scrollY;
                const clientX = rect.left;
                const clientY = rect.bottom;
                
                this.lookupWord(word, pageX, pageY, clientX, clientY);
            } else {
                UI.hideTooltip();
            }
        },

        /**
         * Extract a single Latin word from selected text
         */
        extractLatinWord: function (selectedText) {
            // Remove extra whitespace and normalize
            const cleanText = selectedText.replace(/\s+/g, ' ').trim();
            
            // If it's a single word, check if it's Latin
            const words = cleanText.split(/\s+/);
            
            if (words.length === 1) {
                const word = this.normalizeWord(words[0]);
                return this.isLatinWord(word) ? word : null;
            }
            
            // If multiple words, try to find the first Latin word
            for (const word of words) {
                const normalized = this.normalizeWord(word);
                if (this.isLatinWord(normalized)) {
                    return normalized;
                }
            }
            
            return null;
        },

        /**
         * Normalize a word by removing punctuation
         */
        normalizeWord: function (word) {
            // Remove trailing punctuation common in text
            return word.replace(/[.,;:!?)"\]]*$/, '').replace(/^[("\[]*/, '');
        },

        /**
         * Check if a word is a valid Latin word
         */
        isLatinWord: function (word) {
            // Allow macrons, at least 2 letters. Exclude pure numbers.
            return /^[a-zA-ZāēīōūĀĒĪŌŪ]{2,}$/.test(word) && !/^\d+$/.test(word);
        },

        /**
         * Strip macrons from vowels for API lookup
         */
        stripMacrons: function (word) {
            // Replace all macron vowels with their non-macron equivalents
            return word.replace(/[āĀ]/g, 'a')
                .replace(/[ēĒ]/g, 'e')
                .replace(/[īĪ]/g, 'i')
                .replace(/[ōŌ]/g, 'o')
                .replace(/[ūŪ]/g, 'u');
        },

        /**
         * Look up a word using the Latin API
         */
        lookupWord: function (word, pageX, pageY, clientX, clientY) {
            Logger.debug(`Looking up selected word: ${word} at doc(${pageX}, ${pageY}), view(${clientX}, ${clientY})`);

            // Store the original word with macrons for display
            const originalWord = word;

            // Strip macrons before API lookup
            const lookupWord = this.stripMacrons(word);
            Logger.debug(`Stripped macrons for lookup: "${originalWord}" -> "${lookupWord}"`);

            if (this.cache[lookupWord]) {
                Logger.debug(`Using cached result for "${lookupWord}"`);
                UI.showTooltip(pageX, pageY, clientX, clientY, UI.formatWordInfo(this.cache[lookupWord]));
                return;
            }

            UI.showTooltip(pageX, pageY, clientX, clientY, '<div class="latin-lookup-loading">Looking up word...</div>');

            LatinAPI.lookupWord(lookupWord)
                .then(response => {
                    const parsedData = ResponseParser.parse(response);
                    this.cache[lookupWord] = parsedData;
                    UI.showTooltip(pageX, pageY, clientX, clientY, UI.formatWordInfo(parsedData));
                })
                .catch(error => {
                    Logger.error(`Failed to lookup word "${lookupWord}": ${error}`);
                    UI.showTooltip(pageX, pageY, clientX, clientY, '<div class="latin-lookup-error">Failed to lookup word</div>');
                });
        }
    };

    // ====================================
    // Styles (ADD styles for new elements)
    // ====================================
    function addStyles() {
        const css = `
            #latin-lookup-tooltip {
                background-color: #fff;
                border-radius: 6px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                padding: 12px;
                max-width: 400px; /* Increased max-width */
                font-family: 'Segoe UI', Tahoma, sans-serif;
                font-size: 14px;
                line-height: 1.4;
                color: #333;
                transition: opacity 0.2s ease-in-out;
                border-left: 4px solid #5a67d8;
                pointer-events: auto; /* Allow interaction with tooltip for selection-based lookup */
            }

            #latin-lookup-toggle { /* (Keep toggle styles as is) */
                position: fixed; bottom: 20px; right: 20px;
                width: 40px; height: 40px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; font-weight: bold; font-size: 18px;
                z-index: 10001; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                transition: all 0.2s ease; user-select: none;
            }
            .latin-lookup-enabled { background-color: #5a67d8; color: #fff; }
            .latin-lookup-disabled { background-color: #d1d5db; color: #6b7280; }
            #latin-lookup-toggle:hover { transform: scale(1.1); }

            /* Entry & Header Styles */
             .latin-lookup-entry { margin-bottom: 10px; }
             .latin-lookup-entry:last-child { margin-bottom: 0; }
            .latin-lookup-header {
                margin-bottom: 5px; /* Reduced margin */
                padding-bottom: 4px; /* Reduced padding */
                 border-bottom: 1px solid #e5e7eb;
                 display: flex; /* Use flexbox for alignment */
                 flex-wrap: wrap; /* Allow wrapping */
                 align-items: baseline; /* Align items nicely */
            }
            .latin-lookup-word {
                font-weight: bold; font-size: 16px; color: #4c51bf;
                margin-right: 8px; /* Space between word and POS */
            }
            .latin-lookup-pos {
                font-style: italic; color: #6b7280; font-size: 13px; /* Slightly smaller POS */
            }
            .latin-lookup-entry-details { /* Style for frequency, usage notes etc. */
                font-size: 11px; color: #888; margin-bottom: 5px;
                font-style: italic;
            }

             /* Grammatical Info Styles */
            .latin-lookup-grammar-section {
                margin-bottom: 10px; padding-bottom: 5px;
                 border-bottom: 1px dashed #ccc; /* Dashed border */
                 font-size: 12px;
            }
             .latin-lookup-grammar-section strong { color: #555; }
             .latin-lookup-grammar-section ul { margin: 2px 0 0 0; padding-left: 18px; list-style-type: circle; }
             .latin-lookup-grammar-section li { margin-bottom: 2px; }
             .latin-lookup-grammar-form { font-style: italic; color: #333; } /* Queried form itself */

             /* Definitions */
            .latin-lookup-definitions ul {
                margin: 0; padding-left: 20px; list-style-type: disc; /* Use disc */
            }
            .latin-lookup-definitions li { margin-bottom: 4px; }
            .latin-lookup-definitions p { /* Style for "No definitions" message */
                font-style: italic; color: #888; margin: 5px 0;
            }

            /* General Notes & Separator */
             .latin-lookup-general-notes {
                 margin-top: 10px; padding-top: 5px;
                 border-top: 1px dashed #ccc;
                 font-size: 11px; color: #6b7280; font-style: italic;
             }
            .latin-lookup-entry-separator {
                border: none; border-top: 1px dotted #ccc; margin: 10px 0;
            }


            /* Loading/Error Styles */
            .latin-lookup-loading { font-style: italic; color: #6b7280; }
            .latin-lookup-error { color: #e53e3e; font-weight: bold; }
        `;

        GM_addStyle(css);
        Logger.debug("Styles added");
    }

    // ====================================
    // Initialization (Keep as is)
    // ====================================
    function initialize() {
        Logger.info("Initializing Latin Word Lookup");
        addStyles();
        UI.init();
        WordLookup.init();
        Logger.info("Latin Word Lookup Initialized Successfully");
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();