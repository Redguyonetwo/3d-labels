var colour = []
var filledPixels = []
const encoder = new TextEncoder();
const decoder = new TextDecoder();
//ChatGPT compression using pako.js library
// Compress any JSON-serializable object
function compressJSON(obj) {
    // 1. JSON stringify
    const jsonStr = JSON.stringify(obj);

    // 2. Encode to UTF-8
    const bytes = encoder.encode(jsonStr);

    // 3. Compress
    const compressed = pako.deflate(bytes);

    // 4. Convert to Base64 safely (chunked to avoid call stack crash)
    let binary = "";
    const chunkSize = 0x8000; // 32KB
    for (let i = 0; i < compressed.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
            null,
            compressed.subarray(i, i + chunkSize)
        );
    }
    return btoa(binary);
}

function decompressJSON(base64Str) {
    // 1. Base64 decode
    const binary = atob(base64Str);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    // 2. Inflate (decompress)
    const decompressed = pako.inflate(bytes);

    // 3. Decode UTF-8
    const jsonStr = decoder.decode(decompressed);

    // 4. Parse JSON
    return JSON.parse(jsonStr);
}

function save() {
    return compressJSON(canvasData); // Turns data into a JSON
}

function load(data, canvas, ctx, override=false) { 
    data = decompressJSON(data)
    if (override) {
      canvasDataBreaks = data.length - 1
      canvasData = data
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clears the canvas
    ctx.save()
    ctx.scale(canvas.width / 1800, canvas.height / 968)
    // HENRY CODE STARTS HERE
    for (var l = 0; l < data.length; l++) { // Redraws each line one by one with the same parameters with which they were initially drawn
        if (data[l][0] == "pen") {
            ctx.globalCompositeOperation = "source-over";
            for (var i = 0; i < data[l].length; i++) {
                if (data[l][i][4] != undefined) {
                    console.log(data[l][i][4])
                    rgbToHexConverter(data[l][i][4], data[l][i][6])
                    ctx.beginPath();
                    ctx.moveTo(data[l][i][0], data[l][i][1]);
                    ctx.lineTo(data[l][i][2], data[l][i][3]);
                    ctx.strokeStyle = "rgba("+colour[0]+", "+colour[1]+", "+colour[2]+", "+colour[3]+")"
                    ctx.lineWidth = data[l][i][5];
                    ctx.lineCap = "round"
                    ctx.stroke();
                    if (colour[3] != 1) {
                        ctx.globalCompositeOperation = "destination-out";
                        ctx.beginPath()
                        ctx.arc(data[l][i][2], data[l][i][3], data[l][i][5]/2, 0, 2*Math.PI)
                        ctx.fillStyle = "rgba("+colour[0]+", "+colour[1]+", "+colour[2]+", "+1+")"
                        ctx.fill();
                        ctx.globalCompositeOperation = "source-over";
                    }
                }
            }
        }
        else if (data[l][0] == "eraser") {
            ctx.globalCompositeOperation = "destination-out";
            for (var i = 0; i < data[l].length; i++) {
                ctx.beginPath();
                ctx.moveTo(data[l][i][0], data[l][i][1]);
                ctx.lineTo(data[l][i][2], data[l][i][3]);
                ctx.strokeStyle = "rgba(0,0,0,1)";
                ctx.lineWidth = data[l][i][5];
                ctx.lineCap = "round";
                ctx.stroke();
            }
        }
        else if (data[l][0] == "bucket") {
            ctx.globalCompositeOperation = "source-over";
            filledPixels = []
            floodFill(data[l][1][0], data[l][1][1], data [l][1][2])
            ctx.fillStyle = "rgba("+colour[0]+", "+colour[1]+", "+colour[2]+", "+colour[3]+")";
            for (i = 0; i < filledPixels.length - 1; i++) {
                var intCoords = filledPixels[i].split(" ")
                ctx.fillRect(intCoords[0], intCoords[1], 1, 1)
            }
        }
    };
    ctx.restore()
};

function rgbToHexConverter(hex, opacity) { // Contrary to the name, this converts hex codes to rgb values and sets the colour array to the rgba values
    const r = parseInt(hex.slice(1, 3), 16); // These 3 lines get the rgb values from the hex code
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    colour = []; // Clears the 'colour' array for it to be updated
    colour.push(r, g, b, parseFloat(Math.abs(1-opacity))); // Updates the 'colour' array to have the new rgba values 
};
// HENRY CODE ENDS HERE

// ChatGPT CODE STARTS HERE
function floodFill(startX, startY, targetColour) {
    const stack = [[startX, startY]];
    const key = (x, y) => `${x} ${y}`;
    const visited = new Set();

    while (stack.length > 0) {
        const [x, y] = stack.pop();

        // Skip if already visited
        if (visited.has(key(x, y))) continue;
        visited.add(key(x, y));

        // Skip if not target colour
        if (getPixelColour(x, y) !== targetColour) continue;

        // Mark / fill pixel
        filledPixels.push(key(x, y));

        // Push orthogonal neighbours
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
    }
    // console.log(filledPixels)
}

function getPixelColour(x, y) {
    const imageData = ctx.getImageData(x, y, 1, 1); 
    const [r, g, b, a] = imageData.data;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}
// ChatGPT CODE ENDS HERE