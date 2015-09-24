
/*
 TODO
 - jump to iteration
 - breadth first search
 - use react?
 - options: area power, draw style, speed by area or error/priority
 - leaf size vs max depth
 - color space ?
 - improve initial load speed?
    - integral image - summed area table
 - es6
 - gulp
 - transitions, animating opacity
  */

var canvas = document.querySelector('#canvas');
var context = canvas.getContext('2d');

var quadTree;
var frameId;
var prevDraw;
var itersPerSec = 20;
var skippedFrames = 0;
var mousedown = false;
var coords = null;

function play() {
    if (frameId) {
        return;
    }
    prevDraw = performance.now();
    frameId = requestAnimationFrame(animate);
}

function pause() {
    if (!frameId) {
        // note that requestAnimationFrame() gives non-zero id -> Boolean true
        return;
    }
    cancelAnimationFrame(frameId);
    frameId = null;
    render();
}

function step() {
    quadTree.splitNext();
    render();
}

function reset() {
    pause();
    quadTree.reset();
    skippedFrames = 0;
    render();
}

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
    // TODO refactor speed and animation code into quadtree class?
    // split and draw elements at given speed
    var iters = itersPerSec*(timestamp - prevDraw)/1000;
    if (iters >= 1) {
        var remainder = (iters - Math.floor(iters)) * 1000/itersPerSec;
        prevDraw = timestamp - remainder;
        iters = Math.floor(iters);
        for (var i = 0; i < iters && !quadTree.done(); i++) {
            if (mousedown) {
                quadTree.splitCoord(coords.x, coords.y);
            } else {
                quadTree.splitNext();
            }
        }

        // log skipped frames from quadtree
        var interval = performance.now() - timestamp;
        var frames = Math.round(interval*60/1000);
        if (frames > 1) {
            skippedFrames += frames - 1;
            console.log('iter', (quadTree.size() - 1)/3,
                        interval + 'ms,',
                        (frames - 1), 'skipped frames');
        }
    }
    render();

    frameId = requestAnimationFrame(animate);
}

// set up controls
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

document.querySelector('#speed')
    .addEventListener('input', function(e) {
        document.querySelector('#speedOutput').value = this.value;
        itersPerSec = this.value;
    });
document.querySelector('#speed').value = itersPerSec;
document.querySelector('#speedOutput').value = itersPerSec;

// set up image loader and quadtree prep
(function() {
    function prepQuads() {
        pause();
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        // show loading text while constructing quadtree
        document.querySelector('#info').textContent = 'loading...';
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
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
        reader.addEventListener('load', function (e) {
            img.src = e.target.result;
        });
        reader.readAsDataURL(file);
    }
    var input = document.querySelector('#fileInput');
    input.addEventListener('change', readImage);
})();

// setup split quads that are clicked
(function() {
    function getCanvasXY(event) {
        // x y coords from click event, relative to canvas
        var rect = event.target.getBoundingClientRect();
        var style = window.getComputedStyle(event.target);
        var borderLeft = parseInt(style.getPropertyValue('border-left-width'));
        var borderTop = parseInt(style.getPropertyValue('border-top-width'));
        var borderRight = parseInt(style.getPropertyValue('border-right-width'));
        var borderBottom = parseInt(style.getPropertyValue('border-bottom-width'));
        var paddingLeft = parseInt(style.getPropertyValue('padding-left'));
        var paddingTop = parseInt(style.getPropertyValue('padding-top'));
        var paddingRight = parseInt(style.getPropertyValue('padding-right'));
        var paddingBottom = parseInt(style.getPropertyValue('padding-bottom'));

        var scaledX = event.clientX - (rect.left + borderLeft + paddingLeft);
        var scaledY = event.clientY - (rect.top + borderTop + paddingTop);
        var scaledWidth = rect.width - (borderLeft + paddingLeft + borderRight + paddingRight);
        var scaledHeight = rect.height - (borderTop + paddingTop + borderBottom + paddingBottom);
        return {
            'x': scaledX * canvas.width / scaledWidth,
            'y': scaledY * canvas.height / scaledHeight
        };
    }

    function splitClickedQuad(event) {
        var coords = getCanvasXY(event);
        quadTree.splitCoord(coords.x, coords.y);
        render();
    }
    canvas.addEventListener('click', splitClickedQuad);

    // split while mousedown
    var wasPlaying = false;
    canvas.addEventListener('mousedown', function (e) {
        wasPlaying = Boolean(frameId);
        mousedown = true;
        coords = getCanvasXY(e);
        play();
    });
    canvas.addEventListener('mousemove', function (e) {
        if (mousedown) {
            coords = getCanvasXY(e);
        }
    });
    // allow mouse to leave canvas while mousedown
    document.addEventListener('mouseup', function (e) {
        if (mousedown) {
            mousedown = false;
            if (!wasPlaying) {
                pause();
            }
        }
    });
    canvas.addEventListener('mouseleave', function (e) {
        coords = {x: -1, y: -1};
    });
})();