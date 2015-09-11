
var canvas = document.querySelector('#canvas');
var context = canvas.getContext('2d');

var prevDraw;
var itersPerSec = 10;
var timestamps = [];  // to debug slow frames
var skippedFrames = 0;
var frameId;
var quadTree;

function render() {
    // info external to quadTree
    var iters = (quadTree.size() - 1)/3;
    var textInfo = iters + ' iters';
    textInfo += ', ' + skippedFrames + ' skipped frames (60 FPS)';
    document.querySelector('#info')
        .textContent = textInfo;
}

function animate(timestamp) {
    if (quadTree.done()) {
        console.log('done');
        return;
    }
    // log skipped frames
    var interval = timestamp - timestamps[timestamps.length - 1];
    var frames = Math.round(interval*60/1000);
    if (frames > 2) {
        skippedFrames += frames - 1;
        console.log(interval + 'ms, ' + (frames - 1), 'skipped frames');
    }
    timestamps.push(timestamp);

    // split and draw elements at given speed
    var iters = itersPerSec*(timestamp - prevDraw)/1000;
    if (iters >= 1) {
        var remainder = (iters - Math.floor(iters)) * 1000/itersPerSec;
        prevDraw = timestamp - remainder;
        iters = Math.floor(iters);
        for (var i = 0; i < iters && !quadTree.done(); i++) {
            quadTree.splitNext();
        }
    }

    render();
    frameId = requestAnimationFrame(animate);
}

function reset() {
    pause();
    quadTree.reset();
    skippedFrames = 0;
    render();
}

function pause() {
    if (!frameId) {
        // note that requestAnimationFrame() gives non-zero id -> Boolean true
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
    quadTree.splitNext();
    render();
}

function prepQuads() {
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);
    // show loading text while constructing quadtree
    requestAnimationFrame(function() {
        document.querySelector('#info').textContent = 'loading...';
        requestAnimationFrame(function() {
            quadTree = new QuadTree(context);
            reset();
        });
    });
}

var img = new Image();
img.addEventListener('load', prepQuads);
img.src = 'image.png';  // default image

function readImage() {
    if (this.files.length === 0) {
        return;
    }
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