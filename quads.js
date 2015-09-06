
/*
if (document.readyState != 'loading') {
    init();
} else {
    document.addEventListener("DOMContentLoaded", init);
}
*/

var canvas = document.querySelector('#canvas');
var context = canvas.getContext('2d');

function AreaNode(dx, dy, dw, dh, depth) {
    this.dx = dx;
    this.dy = dy;
    this.dw = dw;
    this.dh = dh;
    this.depth = depth;
    this.meanRGB = integralImage.meanRGB(dx, dy, dw, dh);
    this.varRGB = integralImage.varRGB(dx, dy, dw, dh);
    this.sumSquaredError = dw * dh * this.varRGB.reduce(function(a, b) { return a + b; });
}
AreaNode.prototype.children = function() {
    if (!this._children) {
        if (this.dw == 1 && this.dh == 1) {
            this._children = [];
        } else {
            // split into up to 4 quadrants with dimensions:
            // w1 x h1 | w2 x h1
            // w1 x h2 | w2 x h2
            // w1 or h1 may be zero
            var w1 = Math.floor(this.dw / 2);
            var w2 = this.dw - w1;
            var h1 = Math.floor(this.dh / 2);
            var h2 = this.dh - h1;
            var newDepth = this.depth + 1;
            var children = [];
            // top left, top right, bottom left, bottom right
            if (w1 > 0 && h1 > 0) {
                children.push(new AreaNode(this.dx, this.dy, w1, h1, newDepth));
            }
            if (h1 > 0) {
                children.push(new AreaNode(this.dx + w1, this.dy, w2, h1, newDepth));
            }
            if (w1 > 0) {
                children.push(new AreaNode(this.dx, this.dy + h1, w1, h2, newDepth));
            }
            children.push(new AreaNode(this.dx + w1, this.dy + h1, w2, h2, newDepth));
            this._children = children;
        }
    }

    return this._children;
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

var draw;
var n;
var maxIters = Number.POSITIVE_INFINITY;
var start;
var prevTimestamp;
var nps = 100;
var depthPerSec = 1;
var intervals = [];
var nodeOrder;
var orig;
var integralImage;
var layered = false;
function begin() {
    orig = context.getImageData(0, 0, canvas.width, canvas.height);
    integralImage = new IntegralImage(orig);
    n = 0;
    var nodes = [new AreaNode(0, 0, canvas.width, canvas.height, 0)];
    // priority queue by largest variance
    var heapq = new Heapq(function(a, b) { return b.sumSquaredError - a.sumSquaredError; });
    // pre-process node drawing order
    nodeOrder = [];
    for (var i = 0; i < maxIters; i++) {
        if (nodes.length === 0) break;

        var node = heapq.heappop(nodes);
        nodeOrder.push(node);
        node.children().forEach(function(x) { heapq.heappush(nodes, x); });
    }

    // if draw by depth
    if (layered) {
        nodeOrder.sort(function(a, b) { return a.depth - b.depth; });
    }

    draw = function draw(timestamp) {
        if (n === nodeOrder.length) {
            console.log('done', timestamp - start);
            return;
        }

        var interval = timestamp - prevTimestamp;
        intervals.push(interval);
        prevTimestamp = timestamp;

        var stopIndex = n;
        if (layered) {
            // draw nodes by depth
            var currentDepth = nodeOrder[n].depth;
            if ((timestamp - start)*depthPerSec/1000 >= currentDepth) {
                while (stopIndex < nodeOrder.length
                        && nodeOrder[stopIndex].depth === currentDepth) {
                    stopIndex += 1;
                }
            }
        } else {
            stopIndex = Math.floor(nps*(timestamp - start)/1000);
            stopIndex = Math.min(stopIndex, nodeOrder.length);
        }

        while (n < stopIndex) {
            var node = nodeOrder[n];
            node.children().forEach(function (a) {
                context.fillStyle = 'rgb(' + a.meanRGB.join(',') + ')';
                context.fillRect(a.dx, a.dy, a.dw, a.dh);
                context.strokeRect(a.dx, a.dy, a.dw, a.dh);
            });
            n += 1;
        }

        requestAnimationFrame(draw);
    };
    console.log('drawing...');
    prevTimestamp = start = performance.now();
    requestAnimationFrame(draw);
}


function imageToCanvas() {
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);
}
var img = new Image();
img.addEventListener('load', imageToCanvas);
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

function timeFillRect(r, g, b) {
    // to test drawing speed
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