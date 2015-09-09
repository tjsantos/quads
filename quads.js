
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

    var meanRGB = integralImage.meanRGB(dx, dy, dw, dh);
    var r = Math.round(meanRGB[0]);
    var g = Math.round(meanRGB[1]);
    var b = Math.round(meanRGB[2]);
    this.color = 'rgb(' + r + ',' + g + ',' + b + ')';

    var varRGB = integralImage.varRGB(dx, dy, dw, dh);
    this.priority = dw * dh * varRGB.reduce(function(a, b) { return a + b; });
    this.isLeaf = (dw <= 4 || dh <= 4 || this.priority === 0);
    this.id = id++;
}
Quad.prototype.draw = function() {
    context.fillStyle = this.color;
    context.fillRect(this.dx, this.dy, this.dw, this.dh);
    //context.strokeRect(this.dx, this.dy, this.dw, this.dh);
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
        return x/n;
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

function Heapq(cmp, id) {
    if (typeof cmp !== 'function') {
        throw new TypeError('expected comparison function');
    }
    if (typeof id !== 'function') {
        throw new TypeError('expected id function');
    }

    this.cmp = cmp;
    this.id = id;
    this.heap = [];
    this.heapIndex = {};
}
Heapq.prototype.contains = function(item) {
    return this.heapIndex.hasOwnProperty(this.id(item));
};
Heapq.prototype.peek = function() {
    if (this.heap.length === 0) throw new Error('heap is empty');
    return this.heap[0];
};
Heapq.prototype.heappush = function(item) {
    if (this.contains(item)) {
        throw new Error('item already in heap');
    }
    var heap = this.heap;
    heap.push(item);
    this.heapIndex[this.id(item)] = heap.length - 1;
    this._bubbleUp(heap.length - 1);
};
Heapq.prototype.heappop = function(item) {
    var heap = this.heap;
    if (heap.length === 0) {
        throw new Error('heap is empty');
    }
    item = item || this.peek();  // default to min item in heap
    if (!this.contains(item)) {
        throw new Error('item is not in heap');
    }
    // exchange item with last item in heap array, then remove it
    var i = this.heapIndex[this.id(item)];
    this._exchange(i, heap.length - 1);
    var result = heap.pop();
    delete this.heapIndex[this.id(item)];
    // restore heap invariant
    this._bubbleUp(i);
    this._bubbleDown(i);

    return result;
};
Heapq.prototype.clear = function() {
    this.heap = [];
    this.heapIndex = {};
};
Heapq.prototype._exchange = function(i, j) {
    var heap = this.heap;
    var tmp = heap[i];
    heap[i] = heap[j];
    heap[j] = tmp;
    this.heapIndex[this.id(heap[i])] = i;
    this.heapIndex[this.id(heap[j])] = j;
};
Heapq.prototype._bubbleUp = function(i) {
    var heap = this.heap;
    var parent = Math.floor((i - 1)/2);
    while (parent >= 0 && this.cmp(heap[i], heap[parent]) < 0) {
        this._exchange(i, parent);
        i = parent;
        parent = Math.floor((i - 1)/2);
    }
};
Heapq.prototype._bubbleDown = function(i) {
    var heap = this.heap;
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
            this._exchange(i, min);
            i = min;
        }
    }
};

var quadHeap = new Heapq(function cmp(a, b) {
    // leaves have least priority
    if (a.isLeaf) return (b.isLeaf ? 0 : 1);
    else if (b.isLeaf) return (a.isLeaf ? 0 : -1);
    else return (b.priority - a.priority);
}, function id(item) {
    return item.id;
});

var prevDraw;
var itersPerSec = 10;
var timestamps = [];  // to debug slow frames
var integralImage;
var frameId;
var toDraw = [];
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
        toDraw.push(quad);
        quadHeap.heappush(quad);
    });
}

function render() {
    toDraw.forEach(function(quad) {
        quad.draw();
    });
    toDraw = [];
}

function animate(timestamp) {
    if (quadHeap.peek().isLeaf) {
        console.log('done');
        return;
    }
    timestamps.push(timestamp);
    var iters = itersPerSec*(timestamp - prevDraw)/1000;
    if (iters >= 1) {
        prevDraw = timestamp;
        for (var i = 0; i < iters && !quadHeap.peek().isLeaf; i++) {
            split(quadHeap.peek());
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
    var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    integralImage = new IntegralImage(imageData);
    quadHeap.clear();
    quadHeap.heappush(new Quad(0, 0, canvas.width, canvas.height, 0));
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