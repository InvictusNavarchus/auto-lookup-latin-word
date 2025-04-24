## Overview

design and develop a modern and beautiful automatic latin lookup script that lookup latin words the mouse hovers over them and display the result next to the cursor.

## How it Works

The script works by querying a public latin dictionary API. The sample request can be seen on sampleRequest.js

## Word Display

The response from the API is quite raw and not formatted tidly despite having quite consistent structure. Take care of that. You can see the json from sample-response for response examples. 

## Features

it has a visible overlay toggle of on/off. If it's on, it will always listen for a mouse hover over every word.

There should be a comprehensive logging system to ensure the developer can catch and narrow down any mistake or error easily. 

## Constraints

To avoid uneeded request, add a small, yet reasonable delay after a valid hover before attempting to send the request. 