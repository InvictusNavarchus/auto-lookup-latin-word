# Auto Lookup Latin Word Userscript

A userscript designed to assist users reading Latin text on Vicipaedia (the Latin Wikipedia) by providing quick access to word definitions.

## Description

This script monitors mouse movements over text content on `https://la.wikipedia.org/*`. When the cursor hovers over a potential Latin word for a brief period, the script automatically queries the `latin-words.com` service for its definition and grammatical information. The results are then displayed in a convenient tooltip near the cursor.

## Features

* **On-Hover Lookup:** Automatically detects Latin words under the cursor.
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
3.  **Hover:** Move your mouse cursor over any Latin word within the main text content.
4.  **View Tooltip:** After a short delay (approx. 350ms), a tooltip should appear near the word, displaying its definition and grammatical details fetched from `latin-words.com`.
5.  **Hide Tooltip:** Move the cursor away from the word, scroll the page, or click the toggle button to disable lookups. The tooltip will disappear automatically.

## How It Works

* The script listens for `mousemove` events.
* It attempts to identify the word directly under the cursor using `document.caretPositionFromPoint` or `document.caretRangeFromPoint`.
* It validates if the identified text is likely a Latin word (alphabetic characters, including macrons, minimum length 2).
* A timer prevents lookups on rapid mouse movements.
* If the same word remains under the cursor for the duration of the `hoverDelay`, the script proceeds.
* Macrons are stripped from the word before checking the cache or making an API request.
* If not cached, it makes a `GM_xmlhttpRequest` to the `latin-words.com` endpoint.
* The JSON response is parsed to extract grammatical forms, dictionary entries, and definitions.
* This parsed information is formatted into HTML.
* The HTML content is displayed in the tooltip element, positioned near the cursor while avoiding screen edges.

## Dependencies

* **Userscript Manager:** Required to execute the script (e.g., Tampermonkey).
* **`latin-words.com`:** Relies on the availability and response format of this external service for definitions. Changes to their API or website structure may break the script's functionality.

## Limitations & Considerations

* The accuracy of definitions and parsing depends entirely on the data provided by `latin-words.com` and the script's ability to interpret its specific format.
* The word detection mechanism might occasionally fail on complex page layouts or specific HTML structures.
* Performance may vary depending on the complexity of the page and the browser.
* Works only on the specified `@match` domain (`la.wikipedia.org`).
