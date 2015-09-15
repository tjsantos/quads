
var Quad = (function() {

    function Quad(dx, dy, dw, dh, depth) {
        this.dx = dx;
        this.dy = dy;
        this.dw = dw;
        this.dh = dh;
        this.depth = depth;
        this.id = id++;
        // children nodes
        this.NW = null;
        this.NE = null;
        this.SW = null;
        this.SE = null;
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

        this._priority = {};  // cache of priority values
        var qt = this;
        this.quadHeap = new Heapq(function cmp(a, b) {
            return qt.priority(a) - qt.priority(b);
        }, function id(item) {
            return item.id;
        });

        var x = 0;
        var y = 0;
        var depth = 0;
        var width = this.context.canvas.width;
        var height = this.context.canvas.height;
        this.root = new Quad(x, y, width, height, depth);
        // prep tree
        var n = 0;
        (function build(quad) {
            if (qt.isLeaf(quad)) {
                return;
            }
            n += 1;
            qt.prepSplit(quad);
            build(quad.NW);
            build(quad.NE);
            build(quad.SW);
            build(quad.SE);
        })(this.root);

        this.reset();

        console.log(performance.now() - timer + 'ms QuadTree construction');
        console.log('tree size:', n);
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
        return this.priority(quad) === 0;
    };
    QuadTree.prototype.reset = function() {
        this.quadHeap.clear();
        this.quadHeap.heappush(this.root);
        this.drawQuad(this.root);
    };
    QuadTree.prototype.prepSplit = function(quad) {
        // TODO refactor prepSplit() code into getChildren()
        if (this.isLeaf(quad)) {
            console.log('cannot split quad leaf');
            return;
        }
        if (quad.NW) {
            return;
        }
        var w1 = Math.ceil(quad.dw / 2);
        var w2 = quad.dw - w1;
        var h1 = Math.ceil(quad.dh / 2);
        var h2 = quad.dh - h1;
        var newDepth = quad.depth + 1;
        quad.NW = new Quad(quad.dx, quad.dy, w1, h1, newDepth);
        quad.NE = new Quad(quad.dx + w1, quad.dy, w2, h1, newDepth);
        quad.SW = new Quad(quad.dx, quad.dy + h1, w1, h2, newDepth);
        quad.SE = new Quad(quad.dx + w1, quad.dy + h1, w2, h2, newDepth);
    };
    QuadTree.prototype.splitQuad = function(quad){
        if (this.isLeaf(quad)) {
            console.log('cannot split quad leaf');
            return;
        }
        var heap = this.quadHeap;
        heap.heappop(quad);
        this.prepSplit(quad);
        heap.heappush(quad.NW);
        heap.heappush(quad.NE);
        heap.heappush(quad.SW);
        heap.heappush(quad.SE);
        this.drawQuad(quad.NW);
        this.drawQuad(quad.NE);
        this.drawQuad(quad.SW);
        this.drawQuad(quad.SE);
    };
    QuadTree.prototype.splitNext = function() {
        if (this.done()) {
            console.log('quadtree is done');
            return;
        }
        this.splitQuad(this.quadHeap.peek());
    };
    QuadTree.prototype.findQuad = function(x, y, quad){
        quad = quad || this.root;
        //console.log(quad.dx, quad.dy, quad.dw, quad.dh, quad.depth);
        // check if x,y in quad
        if (x < quad.dx || x >= quad.dx + quad.dw
            || y < quad.dy || y >= quad.dy + quad.dh) {
            return null;
        }
        // if x,y in active/drawn quads
        if (this.quadHeap.contains(quad)) {
            return quad;
        }
        // recursively search children
        return (this.findQuad(x, y, quad.NW)
                || this.findQuad(x, y, quad.NE)
                || this.findQuad(x, y, quad.SW)
                || this.findQuad(x, y, quad.SE));
    };
    QuadTree.prototype.splitCoord = function(x, y){
        console.log('split', x, y);
        var quad = this.findQuad(x, y);
        if (!quad) {
            console.log('quad not found:', x, y);
        } else if (this.isLeaf(quad)) {
            //console.log("can't split leaf at", x, y);
        } else {
            this.splitQuad(quad);
        }
    };
    QuadTree.prototype.drawQuad = function(quad){
        var meanRGB = this.integralImage.meanRGB(quad.dx, quad.dy, quad.dw, quad.dh);
        var r = Math.round(meanRGB[0]);
        var g = Math.round(meanRGB[1]);
        var b = Math.round(meanRGB[2]);

        context.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        context.fillRect(quad.dx, quad.dy, quad.dw, quad.dh);
        //context.strokeRect(this.dx, this.dy, this.dw, this.dh);
    };
    QuadTree.prototype.priority = function(quad) {
        if (!this._priority.hasOwnProperty(quad.id)) {
            var minWidth = 2;
            var minHeight = 2;
            var isMinSize = function(quad) {
                return (Math.floor(quad.dw/2) < minWidth || Math.floor(quad.dh/2) < minHeight)
            };

            // leaves have least priority (0)
            // leaves are either of min size or have 0 error
            if (isMinSize(quad)) {
                this._priority[quad.id] = 0;
            } else {
                var varRGB = this.integralImage.varRGB(quad.dx, quad.dy, quad.dw, quad.dh);
                var re = Math.sqrt(varRGB[0]);
                var ge = Math.sqrt(varRGB[1]);
                var be = Math.sqrt(varRGB[2]);
                // weighted average by luminance (grayscale)
                var error = 0.299 * re + 0.587 * ge + 0.114 * be;
                var area = quad.dw * quad.dh;
                this._priority[quad.id] = -1 * Math.pow(area, 0.25) * error;
            }
        }
        return this._priority[quad.id];
    };
    //QuadTree.prototype.redraw;

    return QuadTree;
})();

var IntegralImage = (function() {

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
        if (i < heap.length) {
            this._bubbleUp(i);
            this._bubbleDown(i);
        }

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