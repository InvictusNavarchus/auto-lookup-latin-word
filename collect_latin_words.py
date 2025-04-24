#!/usr/bin/env python3
import json
import os
import time
import requests
from tqdm import tqdm

# Configuration
WORD_LIST_PATH = 'sample-words.txt'
OUTPUT_JSON_PATH = 'latin_words_responses.json'
API_URL = 'https://latin-words.com/cgi-bin/translate.cgi'
REQUEST_DELAY = 1  # Delay between requests in seconds

# Headers matching the JS sample
headers = {
    "Host": "latin-words.com",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "X-Requested-With": "XMLHttpRequest",
    "DNT": "1",
    "Connection": "keep-alive",
    "Referer": "https://latin-words.com/"
}

def load_word_list(file_path):
    """Load the list of Latin words from the specified file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return [line.strip() for line in f if line.strip()]
    except Exception as e:
        print(f"Error loading word list: {e}")
        return []

def load_existing_responses():
    """Load existing responses from JSON file if it exists."""
    if os.path.exists(OUTPUT_JSON_PATH):
        try:
            with open(OUTPUT_JSON_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading existing responses: {e}")
    return {}

def save_responses(responses):
    """Save responses to JSON file."""
    try:
        with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(responses, f, indent=2, ensure_ascii=False)
        print(f"\nResponses saved to {OUTPUT_JSON_PATH}")
    except Exception as e:
        print(f"\nError saving responses: {e}")

def fetch_word_definition(word):
    """Fetch definition for a Latin word from the API."""
    try:
        response = requests.get(
            API_URL,
            params={"query": word},
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            try:
                data = response.json()
                # Only store the message part of the response
                return data.get("message", "")
            except json.JSONDecodeError:
                print(f"\nError: Invalid JSON response for word '{word}'")
                return f"ERROR: Invalid JSON response"
        else:
            print(f"\nError: API returned status code {response.status_code} for word '{word}'")
            return f"ERROR: Status code {response.status_code}"
            
    except requests.RequestException as e:
        print(f"\nRequest error for word '{word}': {e}")
        return f"ERROR: Request failed - {str(e)}"

def main():
    # Load word list
    words = load_word_list(WORD_LIST_PATH)
    if not words:
        print("No words found in the word list. Exiting.")
        return
    
    # Load existing responses
    responses = load_existing_responses()
    
    print(f"Loaded {len(words)} words from {WORD_LIST_PATH}")
    print(f"Found {len(responses)} existing responses in {OUTPUT_JSON_PATH}")
    
    # Calculate how many words we need to process
    words_to_process = [word for word in words if word not in responses]
    
    if not words_to_process:
        print("All words have already been processed!")
        return
    
    print(f"Processing {len(words_to_process)} new words...")
    
    # Process each word with a progress bar
    try:
        for word in tqdm(words_to_process, desc="Collecting responses"):
            # Skip if we already have this word
            if word in responses:
                continue
                
            # Fetch definition
            message = fetch_word_definition(word)
            
            # Store only the message part
            responses[word] = message
            
            # Save after each successful fetch to avoid losing data
            save_responses(responses)
            
            # Delay to avoid overwhelming the API
            time.sleep(REQUEST_DELAY)
    
    except KeyboardInterrupt:
        print("\nProcess interrupted by user. Saving current progress...")
    
    finally:
        # Final save
        save_responses(responses)
        
    # Print completion info
    total_words = len(words)
    processed_words = len(responses)
    print(f"\nCompletion: {processed_words}/{total_words} words processed ({processed_words/total_words*100:.1f}%)")
    print("Done!")

if __name__ == "__main__":
    main()