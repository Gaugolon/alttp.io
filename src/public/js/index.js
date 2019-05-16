const screenCanvas = document.getElementById('screen');
const screenContext = screenCanvas.getContext('2d');
const screenImageData = screenContext.getImageData(0, 0, screenCanvas.width, screenCanvas.height);

const mapCanvas = document.getElementById('map');
const mapContext = mapCanvas.getContext('2d');
const mapImageData = mapContext.getImageData(0, 0, mapCanvas.width, mapCanvas.height);

const matchCanvas = document.getElementById('matches');
const matchContext = matchCanvas.getContext('2d');
const matchImageData = matchContext.getImageData(0, 0, matchCanvas.width, matchCanvas.height);

let mapImage = new Image();
let imageLoaded = false;
mapImage.addEventListener('load', () => imageLoaded = true);
mapImage.src = 'http://localhost:8081/public/maps/light_world-2_scaled.jpg';

setInterval(() => {
    fetch('http://localhost:8081/frame')
        .then((data) => data.json())
        .then((data) => {
            // console.log(data.frame.length, ccin);
            console.log(data.pos);
            if (data.frame) {
                for (let i = 0; i < data.frame.length / 3; i++) {
                    screenImageData.data[i * 4 + 0] = data.frame[i * 3 + 0];
                    screenImageData.data[i * 4 + 1] = data.frame[i * 3 + 1];
                    screenImageData.data[i * 4 + 2] = data.frame[i * 3 + 2];
                    screenImageData.data[i * 4 + 3] = 255;
                }
                screenContext.putImageData(screenImageData, 0, 0);
            }
            if (data.pos) {
                if (imageLoaded)
                    mapContext.drawImage(mapImage, 0, 0);
                mapContext.strokeStyle = "#FF0000";
                mapContext.strokeRect(data.pos.x, data.pos.y, data.pos.w, data.pos.h);
            }
            if (data.map) {
                for (let i = 0; i < data.map.length / 3; i++) {
                    mapImageData.data[i * 4 + 0] = data.map[i * 3 + 0];
                    mapImageData.data[i * 4 + 1] = data.map[i * 3 + 1];
                    mapImageData.data[i * 4 + 2] = data.map[i * 3 + 2];
                    mapImageData.data[i * 4 + 3] = 255;
                }
                mapContext.putImageData(mapImageData, 0, 0);
            }
            if (data.matches) {
                for (let i = 0; i < data.matches.length / 3; i++) {
                    matchImageData.data[i * 4 + 0] = data.matches[i * 3 + 0];
                    matchImageData.data[i * 4 + 1] = data.matches[i * 3 + 1];
                    matchImageData.data[i * 4 + 2] = data.matches[i * 3 + 2];
                    matchImageData.data[i * 4 + 3] = 255;
                }
                matchContext.putImageData(matchImageData, 0, 0);
            }



            // console.log('done');
        })
        .catch((error) => console.error(error));
}, 1000);
//# sourceMappingURL=index.js.map