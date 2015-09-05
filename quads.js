
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

var draw;
var n;
var start;
var prevTimestamp;
var npms = 5;
var depthPerSec = 1;
var intervals = [];
var nodes;
var threshold = 5000;
var orig;
var integralImage;
function begin() {
    orig = context.getImageData(0, 0, canvas.width, canvas.height);
    integralImage = new IntegralImage(orig);
    n = 0;
    nodes = [new AreaNode(0, 0, canvas.width, canvas.height, 0)];

    draw = function draw(timestamp) {
        if (n === nodes.length) {
            var actualNps = (n / (timestamp - start)) * 1000;
            console.log(actualNps);
            return;
        }

        var interval = timestamp - prevTimestamp;
        intervals.push(interval);
        prevTimestamp = timestamp;

        // draw nodes by depth
        var currentDepth = nodes[n].depth;
        if ((timestamp - start)*depthPerSec/1000 >= currentDepth) {
            while (n < nodes.length && nodes[n].depth === currentDepth) {
                var node = nodes[n];
                var nodeVarTotal = node.varRGB.reduce(function(a, b) { return a + b; });
                if (nodeVarTotal > threshold) {
                    node.children().forEach(function (a) {
                        context.fillStyle = 'rgb(' + a.meanRGB.join(',') + ')';
                        context.fillRect(a.dx, a.dy, a.dw, a.dh);
                        nodes.push(a);
                    });
                }
                n += 1;
            }
        }

        requestAnimationFrame(draw);
    };
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