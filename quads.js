
/*
if (document.readyState != 'loading') {
    init();
} else {
    document.addEventListener("DOMContentLoaded", init);
}
*/

var canvas = document.querySelector('#canvas');
var context = canvas.getContext('2d');

function Quad(dx, dy, dw, dh, depth) {
    this.dx = dx;
    this.dy = dy;
    this.dw = dw;
    this.dh = dh;
    this.depth = depth;
    this.isLeaf = (this.dw <= 2 || this.dh <= 2);
    this.meanRGB = integralImage.meanRGB(dx, dy, dw, dh);
    var varRGB = integralImage.varRGB(dx, dy, dw, dh);
    this.priority = dw * dh * varRGB.reduce(function(a, b) { return a + b; });
}
Quad.prototype.draw = function() {
    context.fillStyle = 'rgb(' + a.meanRGB.join(',') + ')';
    context.fillRect(a.dx, a.dy, a.dw, a.dh);
    context.strokeRect(a.dx, a.dy, a.dw, a.dh);
};

function IntegralImage(imageData) {
    this.imageData = imageData;
}
IntegralImage.prototype._sumRGB = function(dx, dy, dw, dh) {
    var sumR = 0;
    var sumG = 0;
    var sumB = 0;
    var data = this.imageData.data;
    for (var y = dy; y < dy + dh; y += 1)
        for (var x = dx; x < dx + dw; x += 1) {
            var i = 4*y*this.imageData.width + 4*x;
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
        }
    return [sumR, sumG, sumB];
};
IntegralImage.prototype._sumRGB2 = function(dx, dy, dw, dh) {
    var sumR2 = 0;
    var sumG2 = 0;
    var sumB2 = 0;
    var data = this.imageData.data;
    for (var y = dy; y < dy + dh; y += 1)
        for (var x = dx; x < dx + dw; x += 1) {
            var i = 4*y*this.imageData.width + 4*x;
            sumR2 += Math.pow(data[i], 2);
            sumG2 += Math.pow(data[i + 1], 2);
            sumB2 += Math.pow(data[i + 2], 2);
        }
    return [sumR2, sumG2, sumB2];
};
IntegralImage.prototype.meanRGB = function(dx, dy, dw, dh) {
    var n = dw * dh;
    return this._sumRGB(dx, dy, dw, dh).map(function(x) {
        return Math.round(x/n);
    });
};
IntegralImage.prototype.varRGB = function(dx, dy, dw, dh) {
    var n = dw * dh;
    var sumRGB = this._sumRGB(dx, dy, dw, dh);
    var sumRGB2 = this._sumRGB2(dx, dy, dw, dh);
    var result = [];
    for (var i = 0; i < sumRGB.length; i++) {
        // E[X^2] - E[X]^2
        var varX = (sumRGB2[i] / n) - Math.pow(sumRGB[i]/n, 2);
        result.push(varX);
    }
    return result;
};

function Heapq(cmp) {
    if (typeof cmp !== 'function') {
        throw new TypeError('expected comparison function');
    }

    this.cmp = cmp;
}
Heapq.prototype.heapify = function(arr) {
    var n = arr.length;
    for (var i = n - 1; i >= 0; i--) {
        this._bubbleDown(arr, i);
    }
};
Heapq.prototype.heappush = function(heap, item) {
    heap.push(item);
    this._bubbleUp(heap, heap.length - 1);
};
Heapq.prototype.heappop = function(heap) {
    if (heap.length === 0) {
        throw new Error('heap is empty');
    }

    var result = heap[0];
    heap[0] = heap[heap.length - 1];
    heap.pop();
    this._bubbleDown(heap, 0);

    return result;
};
Heapq.prototype._bubbleUp = function(heap, i) {
    var parent = Math.floor((i - 1)/2);
    while (parent >= 0 && this.cmp(heap[i], heap[parent]) < 0) {
        var tmp = heap[parent];
        heap[parent] = heap[i];
        heap[i] = tmp;
        i = parent;
        parent = Math.floor((i - 1)/2);
    }
};
Heapq.prototype._bubbleDown = function(heap, i) {
    var n = heap.length;
    while (true) {
        // determine minimum element among current (i) and two children
        var min = i;
        var left = 2 * i + 1;
        var right = 2 * i + 2;
        if (left < n && this.cmp(heap[left], heap[min]) < 0) {
            min = left;
        }
        if (right < n && this.cmp(heap[right], heap[min]) < 0) {
            min = right;
        }

        // until heap invariant restored, swap current with min and continue bubble down
        if (min === i) {
            break;
        } else {
            var tmp = heap[i];
            heap[i] = heap[min];
            heap[min] = tmp;
            i = min;
        }
    }
};

var heapq = new Heapq(function cmp(a, b) {
    // leaves have least priority
    if (a.isLeaf) return (b.isLeaf ? 0 : 1);
    else if (b.isLeaf) return (a.isLeaf ? 0 : -1);
    else return (b.priority - a.priority);
}, function key(item) {
    return item.id;
});

var maxIters = 10000;
var prevDraw;
var itersPerSec = 10;
var timestamps = [];  // to debug slow frames
var integralImage;
var quadHeap;
var frameId;
var toDraw = [];
var id = 0;

function split(quad) {
    if (quad.isLeaf) {
        throw new TypeError('quad is a leaf -- cannot split');
    }
    heapq.heappop(quadHeap, quad.heapIndex);
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
        toDraw.push(quad);
        heapq.heappush(quadHeap, quad);
    });
}

function render() {
    toDraw.forEach(function(quad) {
        quad.draw();
    });
    toDraw = [];
}

function animate(timestamp) {
    if (quadHeap[0].isLeaf) {
        return;
    }
    timestamps.push(timestamp);
    var iters = itersPerSec*(timestamp - prevDraw)/1000;
    if (iters >= 1) {
        prevDraw = timestamp;
        for (var i = 0; i < iters; i++) {
            split(quadHeap[0]);
        }
        render();
    }

    frameId = requestAnimationFrame(animate);
}

function reset() {
    pause();
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);
    quadHeap = [new Quad(0, 0, canvas.width, canvas.height, 0)];
    var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    integralImage = new IntegralImage(imageData);
}

function pause() {
    if (!frameId) {
        return;
    }
    cancelAnimationFrame(frameId);
    frameId = null;
    prevDraw = null;
}

function play() {
    if (frameId) {
        return;
    }
    prevDraw = performance.now();
    frameId = requestAnimationFrame(animate);
}

function step() {
    split(quadHeap[0]);
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