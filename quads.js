var canvas = document.querySelector('#canvas');
var context = canvas.getContext('2d');

var quadHeap = new Heapq(function cmp(a, b) {
    // leaves have least priority
    if (a.isLeaf) return (b.isLeaf ? 0 : 1);
    else if (b.isLeaf) return (a.isLeaf ? 0 : -1);
    else return (a.priority - b.priority);
}, function id(item) {
    return item.id;
});

var prevDraw;
var itersPerSec = 10;
var timestamps = [];  // to debug slow frames
var skippedFrames = 0;
var integralImage;
var frameId;
var id = 0;

function split(quad) {
    if (quad.isLeaf) {
        throw new TypeError('quad is a leaf -- cannot split');
    }
    quadHeap.heappop(quad);
    var w1 = Math.ceil(quad.dw / 2);
    var w2 = quad.dw - w1;
    var h1 = Math.ceil(quad.dh / 2);
    var h2 = quad.dh - h1;
    var newDepth = quad.depth + 1;
    var children = [
        new Quad(     quad.dx,      quad.dy, w1, h1, newDepth),
        new Quad(quad.dx + w1,      quad.dy, w2, h1, newDepth),
        new Quad(     quad.dx, quad.dy + h1, w1, h2, newDepth),
        new Quad(quad.dx + w1, quad.dy + h1, w2, h2, newDepth)
    ];

    children.forEach(function(quad) {
        quadHeap.heappush(quad);
    });

    children.forEach(function(quad) {
        quad.draw();
    });
}

function render() {
    // info external to quadTree
    var textInfo = (quadHeap.heap.length - 1)/3 + ' iters';
    textInfo += ', ' + skippedFrames + ' skipped frames (60 FPS)';
    document.querySelector('#info')
        .textContent = textInfo;
}

function animate(timestamp) {
    if (quadHeap.peek().isLeaf) {
        console.log('done');
        return;
    }
    // log skipped frames
    var interval = timestamp - timestamps[timestamps.length - 1];
    var frames = Math.round(interval*60/1000);
    if (frames > 1) skippedFrames += frames - 1;
    timestamps.push(timestamp);

    // split and draw elements at given speed
    var iters = itersPerSec*(timestamp - prevDraw)/1000;
    if (iters >= 1) {
        prevDraw = timestamp;
        for (var i = 0; i < iters && !quadHeap.peek().isLeaf; i++) {
            split(quadHeap.peek());
        }
    }
    render();
    frameId = requestAnimationFrame(animate);
}

function reset() {
    pause();
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);
    var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    integralImage = new IntegralImage(imageData);
    quadHeap.clear();
    quadHeap.heappush(new Quad(0, 0, canvas.width, canvas.height, 0));
    quadHeap.heap.forEach(function(quad) {
        quad.draw();
    });
    skippedFrames = 0;
    render();
}

function pause() {
    if (!frameId) {
        // note that id from requestAnimationFrame() is a non-zero value
        return;
    }
    cancelAnimationFrame(frameId);
    frameId = null;
    prevDraw = null;
    render();
}

function play() {
    if (frameId) {
        return;
    }
    prevDraw = performance.now();
    timestamps.push(performance.now());
    frameId = requestAnimationFrame(animate);
}

function step() {
    split(quadHeap.peek());
    render();
}

var img = new Image();
img.addEventListener('load', reset);
img.src = 'image.png';  // default image

function readImage() {
    var file = this.files[0];
    var reader = new FileReader();
    reader.addEventListener('load', function(e) {
        img.src = e.target.result;
    });
    reader.readAsDataURL(file);
}
var input = document.querySelector('#fileInput');
input.addEventListener('change', readImage);

// to test drawing speed
function timeFillRect(r, g, b) {
    var start = performance.now();
    var id = context.createImageData(1, 1);
    var d = id.data;
    for (var x = 0; x < canvas.width; x++) {
        for (var y = 0; y < canvas.height; y++) {
            /*
            d[0] = r;
            d[1] = g;
            d[2] = b;
            d[3] = 255;
            context.putImageData(id, x, y);
            */
            context.fillStyle = 'rgb(' + [r,g,b].join(',') + ')';
            context.fillRect(x, y, 1, 1);
        }
    }
    var end = performance.now();
    console.log(start, end, end - start);
}

document.querySelector('#play').addEventListener('click', play);
document.querySelector('#pause').addEventListener('click', pause);
document.querySelector('#step').addEventListener('click', step);
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#download')
    .addEventListener('click', function(e) {
        var link = e.currentTarget;
        link.href = canvas.toDataURL();
        link.download = "quads.png";
    });