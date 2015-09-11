
var Quad = (function() {

    function Quad(dx, dy, dw, dh, depth) {
        this.dx = dx;
        this.dy = dy;
        this.dw = dw;
        this.dh = dh;
        this.depth = depth;
        this.id = id++;
    }
    var id = 0;

    return Quad;
})();

var QuadTree = (function() {

    function QuadTree(context) {
        if (!(context instanceof CanvasRenderingContext2D)) {
            throw new TypeError('expected CanvasRenderingContext2D');
        }
        var timer = performance.now();

        var imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
        this.integralImage = new IntegralImage(imageData);
        this.context = context;

        var qt = this;
        this.quadHeap = new Heapq(function cmp(a, b) {
            // leaves have least priority
            if (qt.isLeaf(a)) return (qt.isLeaf(b) ? 0 : 1);
            else if (qt.isLeaf(b)) return (qt.isLeaf(a) ? 0 : -1);
            else return (qt.priority(a) - qt.priority(b));
        }, function id(item) {
            return item.id;
        });

        this.reset();
        //while (!this.done()) {
        //    this.splitNext();
        //}

        console.log(performance.now() - timer + 'ms QuadTree construction');
    }

    // area power, draw style, max depth, ...
    //QuadTree.prototype.options;
    QuadTree.prototype.size = function() {
        return this.quadHeap.size();
    };
    QuadTree.prototype.done = function() {
        return this.isLeaf(this.quadHeap.peek());
    };
    QuadTree.prototype.isLeaf = function(quad) {
        return quad.dw <= 4 || quad.dh <= 4 || this.priority(quad) === 0;
    };
    QuadTree.prototype.reset = function() {
        this.quadHeap.clear();
        var x = 0;
        var y = 0;
        var depth = 0;
        var width = this.context.canvas.width;
        var height = this.context.canvas.height;
        this.quadHeap.heappush(new Quad(x, y, width, height, depth));
        this.drawQuad(this.quadHeap.peek());
    };
    QuadTree.prototype.splitQuad = function(quad){
        if (this.isLeaf(quad)) {
            console.log('cannot split quad leaf');
            return;
        }
        this.quadHeap.heappop(quad);
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

        var qt = this;
        children.forEach(function(quad) {
            qt.quadHeap.heappush(quad);
            qt.drawQuad(quad);
        });
    };
    QuadTree.prototype.splitNext = function() {
        if (this.done()) {
            console.log('quadtree is done');
            return;
        }
        this.splitQuad(this.quadHeap.peek());
    };
    //QuadTree.prototype.findQuad = function(x, y){};
    //QuadTree.prototype.splitCoord = function(x, y){};
    QuadTree.prototype.drawQuad = function(quad){
        var meanRGB = this.integralImage.meanRGB(quad.dx, quad.dy, quad.dw, quad.dh);
        var r = Math.round(meanRGB[0]);
        var g = Math.round(meanRGB[1]);
        var b = Math.round(meanRGB[2]);
        var color = 'rgb(' + r + ',' + g + ',' + b + ')';

        context.fillStyle = color;
        context.fillRect(quad.dx, quad.dy, quad.dw, quad.dh);
        //context.strokeRect(this.dx, this.dy, this.dw, this.dh);
    };
    QuadTree.prototype.priority = function(quad) {
        if (!quad.priority) {
            // convert color space? rgb calculation doesn't match human perception...
            var varRGB = this.integralImage.varRGB(quad.dx, quad.dy, quad.dw, quad.dh);
            var re = Math.sqrt(varRGB[0]);
            var ge = Math.sqrt(varRGB[1]);
            var be = Math.sqrt(varRGB[2]);
            // weighted average by luminance (grayscale)
            var error = 0.299 * re + 0.587 * ge + 0.114 * be;
            var area = quad.dw * quad.dh;
            quad.priority = -1 * Math.pow(area, 0.25) * error;
        }
        return quad.priority;
    };
    //QuadTree.prototype.redraw;

    return QuadTree;
})();

var IntegralImage = (function() {

    // TODO convert colorspace?
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

    return IntegralImage;
})();

var Heapq = (function() {

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

    Heapq.prototype.size = function() {
        return this.heap.length;
    };
    Heapq.prototype.contains = function (item) {
        return this.heapIndex.hasOwnProperty(this.id(item));
    };
    Heapq.prototype.peek = function () {
        if (this.heap.length === 0) throw new Error('heap is empty');
        return this.heap[0];
    };
    Heapq.prototype.heappush = function (item) {
        if (this.contains(item)) {
            throw new Error('item already in heap');
        }
        var heap = this.heap;
        heap.push(item);
        this.heapIndex[this.id(item)] = heap.length - 1;
        this._bubbleUp(heap.length - 1);
    };
    Heapq.prototype.heappop = function (item) {
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
    Heapq.prototype.clear = function () {
        this.heap = [];
        this.heapIndex = {};
    };
    Heapq.prototype._exchange = function (i, j) {
        var heap = this.heap;
        var tmp = heap[i];
        heap[i] = heap[j];
        heap[j] = tmp;
        this.heapIndex[this.id(heap[i])] = i;
        this.heapIndex[this.id(heap[j])] = j;
    };
    Heapq.prototype._bubbleUp = function (i) {
        var heap = this.heap;
        var parent = Math.floor((i - 1) / 2);
        while (parent >= 0 && this.cmp(heap[i], heap[parent]) < 0) {
            this._exchange(i, parent);
            i = parent;
            parent = Math.floor((i - 1) / 2);
        }
    };
    Heapq.prototype._bubbleDown = function (i) {
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

    return Heapq;
})();