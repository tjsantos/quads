
var Quad = (function() {

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

        this.priority = -this.calculateError();
        this.isLeaf = (dw <= 4 || dh <= 4 || this.priority === 0);
        this.id = id++;
    }

    Quad.prototype.draw = function () {
        context.fillStyle = this.color;
        context.fillRect(this.dx, this.dy, this.dw, this.dh);
        //context.strokeRect(this.dx, this.dy, this.dw, this.dh);
    };
    Quad.prototype.calculateError = function () {
        // convert color space? rgb calculation doesn't match human perception...
        var varRGB = integralImage.varRGB(this.dx, this.dy, this.dw, this.dh);
        var re = Math.sqrt(varRGB[0]);
        var ge = Math.sqrt(varRGB[1]);
        var be = Math.sqrt(varRGB[2]);
        // weighted average by luminance (grayscale)
        var error = 0.299 * re + 0.587 * ge + 0.114 * be;
        var area = this.dw * this.dh;
        return Math.pow(area, 0.25) * error;
    };

    return Quad;
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