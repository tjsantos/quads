if (document.readyState != 'loading') {
    init();
} else {
    document.addEventListener("DOMContentLoaded", init);
}

function init() {
    var canvas = document.querySelector('#myCanvas');
    var context = canvas.getContext('2d');

    function readImage() {
        var file = this.files[0];
        var reader = new FileReader();
        reader.onload = function(e) {
          var img = new Image();
          img.onload = function(e) {
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);
          }
          img.src = e.target.result;
        }
        reader.readAsDataURL(file);
      }
    var input = document.querySelector('#myInput');
    input.addEventListener('change', readImage);
}
