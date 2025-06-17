# Auto Lookup Latin Word Userscript

![Version](https://img.shields.io/badge/version-0.3.1-blue)
![License](https://img.shields.io/badge/license-GPL--3.0-blue)

A userscript designed to assist users reading Latin text on Vicipaedia (the Latin Wikipedia) by providing quick access to word definitions.

## Description

This script monitors text selections on `https://la.wikipedia.org/*`. When the user selects text containing a Latin word, the script automatically queries the `latin-words.com` service for its definition and grammatical information. The results are then displayed in a convenient tooltip near the selection.

## Features

* **On-Selection Lookup:** Automatically detects Latin words from user text selections.
* **Tooltip Display:** Shows definitions and grammatical analysis in a floating tooltip.
* **Data Source:** Utilizes the `latin-words.com` website via its translation endpoint.
* **Parsing:** Interprets the response from `latin-words.com` to extract dictionary entries (lemma, part of speech, definitions) and grammatical forms of the queried word.
* **Toggle Control:** Includes a floating button ('L') to easily enable or disable the lookup functionality.
* **Basic Caching:** Temporarily caches results for recently looked-up words (macron-stripped form) to reduce redundant API calls during the same session.

## Target Website

This script is specifically configured to run on:

* `https://la.wikipedia.org/*`

## Installation

1.  **Install a Userscript Manager:** You need a browser extension capable of running userscripts. Common options include:
    * [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari, Opera)
    * [Greasemonkey](https://www.greasespot.net/) (Firefox)
    * [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge, Opera)
2.  **Install the Script:** Click on the following link to install the script via your userscript manager:
    * [Install Auto Lookup Latin Word](https://raw.githubusercontent.com/InvictusNavarchus/auto-lookup-latin-word/master/auto-lookup-latin-word.user.js)
    * Your userscript manager should prompt you to confirm the installation.

## Usage

1.  **Navigate:** Go to any page on `https://la.wikipedia.org/`.
2.  **Ensure Enabled:** Check that the floating 'L' button (usually in the bottom-right corner) is blue, indicating the script is active. Click it to toggle between enabled (blue) and disabled (grey) states.
3.  **Select Text:** Highlight any Latin word or text containing Latin words within the main content.
4.  **View Tooltip:** A tooltip will appear near the selection, displaying the definition and grammatical details of the first Latin word found in your selection, fetched from `latin-words.com`.
5.  **Hide Tooltip:** Click elsewhere on the page or make a new selection. The tooltip will disappear automatically.

## How It Works

* The script listens for text selection events (`mouseup`, `keyup`).
* When text is selected, it extracts the first valid Latin word from the selection.
* It validates if the identified text is likely a Latin word (alphabetic characters, including macrons, minimum length 2).
* Macrons are stripped from the word before checking the cache or making an API request.
* If not cached, it makes a `GM_xmlhttpRequest` to the `latin-words.com` endpoint.
* The JSON response is parsed to extract grammatical forms, dictionary entries, and definitions.
* This parsed information is formatted into HTML.
* The HTML content is displayed in the tooltip element, positioned near the selection while avoiding screen edges.

## Dependencies

* **Userscript Manager:** Required to execute the script (e.g., Tampermonkey).
* **`latin-words.com`:** Relies on the availability and response format of this external service for definitions. Changes to their API or website structure may break the script's functionality.

## Limitations & Considerations

* The accuracy of definitions and parsing depends entirely on the data provided by `latin-words.com` and the script's ability to interpret its specific format.
* The selection-based lookup works best with single words or short phrases. For multi-word selections, only the first valid Latin word will be looked up.
* Performance may vary depending on the complexity of the page and the browser.
* Works only on the specified `@match` domain (`la.wikipedia.org`).

## License

This project is licensed under the GPL-3.0.