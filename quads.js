// TODO
// "image loading..." text while loading
// center image and ui
// resizable canvas
// dataURL view image slow ??
// quads stuff
// canvas layers?
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
    // TODO validate input
    this.dx = dx;
    this.dy = dy;
    this.dw = dw;
    this.dh = dh;
    this.depth = depth;
}
AreaNode.prototype.children = function() {
    if (this.dw == 1 && this.dh == 1) {
        return [];
    }

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

    //console.log('p: ' + [this.dx,this.dy,this.dw,this.dh,this.depth].join());
    //children.forEach(function(a) {
    //    console.log('c: ' + [a.dx, a.dy, a.dw, a.dh, a.depth].join());
    //});
    return children;
};

function IntegralImage(imageData) {
    this.imageData = imageData;
    // TODO: pre-calculate area sums
}
IntegralImage.prototype.avg = function(dx, dy, dw, dh) {
    // TODO validate input
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
    var avgRGB = [sumR, sumG, sumB].map(function(x) {
        return Math.floor(x / (dw * dh));
    });
    return avgRGB;
};

function Queue() {
    // two stack implementation
    this.enter = [];
    this.exit = [];
}
Queue.prototype.enqueue = function(item) {
    this.enter.push(item);
};
Queue.prototype._prepExit = function() {
    if (this.exit.length > 0) return;

    while (this.enter.length > 0) {
        this.exit.push(this.enter.pop());
    }
};
Queue.prototype.dequeue = function() {
    if (this.length === 0) throw new Error('queue is empty');

    this._prepExit();
    return this.exit.pop();
};
Queue.prototype.peek = function() {
    if (this.length === 0) throw new Error('queue is empty');

    this._prepExit();
    return this.exit[this.exit.length - 1];
};
Object.defineProperty(Queue.prototype, 'length', {
    get: function() {return this.enter.length + this.exit.length;}
});

var draw;
var n;
var queue;
var start;
var prevTimestamp;
var npms = 5;
var depthPerSec = 1;
var intervals = [];
function begin() {
    var orig = context.getImageData(0, 0, canvas.width, canvas.height);
    var integralImage = new IntegralImage(orig);
    start = null;
    n = 0;
    queue = new Queue();
    queue.enqueue(new AreaNode(0, 0, canvas.width, canvas.height, 0));
    draw = function draw(timestamp) {
        if (queue.length == 0) {
            var actualNps = (n / (timestamp - start)) * 1000;
            console.log(actualNps);
            return;
        }

        var interval = timestamp - prevTimestamp;
        intervals.push(interval);
        prevTimestamp = timestamp;
        var depth = queue.peek().depth;
        if ((timestamp - start)*depthPerSec/1000 >= depth) {
            //for (var i = 0; i < interval * npms && queue.length > 0; i++) {
            while (queue.length && queue.peek().depth === depth) {
                var a = queue.dequeue();
                var avgRGB = integralImage.avg(a.dx, a.dy, a.dw, a.dh);
                context.fillStyle = 'rgb(' + avgRGB.join(',') + ')';
                context.fillRect(a.dx, a.dy, a.dw, a.dh);
                a.children().forEach(function (a) {
                    queue.enqueue(a);
                });
                n += 1;
            }
        }
        requestAnimationFrame(draw);
    };
    prevTimestamp = start = performance.now();
    requestAnimationFrame(draw);
}

function readImage() {
    var file = this.files[0];
    var reader = new FileReader();
    reader.addEventListener('load', function(e) {
        var img = new Image();
        img.addEventListener('load', function(e) {
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);
            begin();
        });
        img.src = e.target.result;
    });
    reader.readAsDataURL(file);
}
var input = document.querySelector('#fileInput');
input.addEventListener('change', readImage);

// default image
var img = new Image();
img.addEventListener('load', function(e) {
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);
});
img.src = 'image.png';
