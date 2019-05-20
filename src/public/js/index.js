const screenCanvas = document.getElementById('screen');
const screenContext = screenCanvas.getContext('2d');
const screenImageData = screenContext.getImageData(0, 0, screenCanvas.width, screenCanvas.height);

const mapCanvas = document.getElementById('map');
const mapContext = mapCanvas.getContext('2d');
const mapImageData = mapContext.getImageData(0, 0, mapCanvas.width, mapCanvas.height);

const spriteMatchesCanvas = document.getElementById('spriteMatches');
let spriteMatchesContext = spriteMatchesCanvas.getContext('2d');
let spriteMatchesImageData = spriteMatchesContext.getImageData(0, 0, spriteMatchesCanvas.width, spriteMatchesCanvas.height);

const spriteCanvas = document.getElementById('sprite');
let spriteContext = spriteCanvas.getContext('2d');
let spriteImageData = spriteContext.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);

const matchCanvas = document.getElementById('matches');
let matchContext = matchCanvas.getContext('2d');
let matchImageData = matchContext.getImageData(0, 0, matchCanvas.width, matchCanvas.height);

let mapImage = new Image();
let imageLoaded = false;
mapImage.addEventListener('load', () => imageLoaded = true);
mapImage.src = 'http://localhost:8081/public/maps/light_world-2_scaled.jpg';

const fetchInterval = 500;


setInterval(() => {
    console.log('fetch');
    fetch('http://localhost:8081/frame', {}, fetchInterval)
        .then((data) => data.json())
        .then((data) => {
            // console.log(data.frame.length, ccin);
            // console.log(data.pos);
            if (data.frame) {
                for (let i = 0; i < data.frame.length / 3; i++) {
                    screenImageData.data[i * 4 + 0] = data.frame[i * 3 + 0];
                    screenImageData.data[i * 4 + 1] = data.frame[i * 3 + 1];
                    screenImageData.data[i * 4 + 2] = data.frame[i * 3 + 2];
                    screenImageData.data[i * 4 + 3] = 255;
                }
                screenContext.putImageData(screenImageData, 0, 0);
            }
            if ((data.pos || data.minLoc || data.maxLoc) && imageLoaded) {
                mapContext.drawImage(mapImage, 0, 0);
                // console.log(data)
                if (data.minLoc) {
                    mapContext.strokeStyle = "#0000FF";
                    mapContext.lineWidth = 4;
                    mapContext.strokeRect(data.minLoc.x / 4, data.minLoc.y / 4, data.minLoc.w / 2, data.minLoc.h / 2);
                }
                if (data.maxLoc) {
                    mapContext.strokeStyle = "#FF0000";
                    mapContext.lineWidth = 4;
                    mapContext.strokeRect(data.maxLoc.x / 4, data.maxLoc.y / 4, data.maxLoc.w / 2, data.maxLoc.h / 2);
                }

            }
            if (data.sprites && data.sprites.length > 0) {
                for (let s = 0; s < data.sprites.length; s++) {

                    for (let i = 0; i < data.sprites[s].matches.length; i++) {
                        // spriteMatchesImageData.data[i] = data.sprites[0].matches[i];
                        const val = data.sprites[s].matches[i];
                        spriteMatchesImageData.data[i * 4 + 0] = val;
                        spriteMatchesImageData.data[i * 4 + 1] = val;
                        spriteMatchesImageData.data[i * 4 + 2] = val;
                        spriteMatchesImageData.data[i * 4 + 3] = 255;
                    }
                    spriteMatchesContext.putImageData(spriteMatchesImageData, 0, 0);

                    // for (let i = 0; i < data.sprites[s].item.length; i++) {
                    //     spriteImageData.data[i * 4 + 0] = data.sprites[0].item[i * 3 + 0];
                    //     spriteImageData.data[i * 4 + 1] = data.sprites[0].item[i * 3 + 1];
                    //     spriteImageData.data[i * 4 + 2] = data.sprites[0].item[i * 3 + 2];
                    //     spriteImageData.data[i * 4 + 3] = 255;
                    // }

                    for (let i = 0; i < data.sprites[s].sprites.length; i++) {
                        const sprite = data.sprites[s].sprites[i];
                        screenContext.strokeStyle = "#FF0000";
                        screenContext.lineWidth = 1;
                        screenContext.strokeRect(sprite.x, sprite.y, sprite.w, sprite.h);
                        // spriteImageData.data[i * 4 + 0] = data.sprites[0].item[i * 3 + 0];
                        // spriteImageData.data[i * 4 + 1] = data.sprites[0].item[i * 3 + 1];
                        // spriteImageData.data[i * 4 + 2] = data.sprites[0].item[i * 3 + 2];
                        // spriteImageData.data[i * 4 + 3] = 255;
                    }

                    // console.log(data.sprites[s].sprites);

                    spriteContext.putImageData(spriteImageData, 0, 0);
                }
            }

            // if (data.pos) {
            //     mapContext.strokeStyle = "#FF0000";
            //     mapContext.lineWidth = 4;
            //     mapContext.strokeRect(data.pos.x / 4, data.pos.y / 4, data.pos.w / 2, data.pos.h / 2);
            // }
            if (data.map) {
                for (let i = 0; i < data.map.length / 3; i++) {
                    mapImageData.data[i * 4 + 0] = data.map[i * 3 + 0];
                    mapImageData.data[i * 4 + 1] = data.map[i * 3 + 1];
                    mapImageData.data[i * 4 + 2] = data.map[i * 3 + 2];
                    mapImageData.data[i * 4 + 3] = 255;
                }
                mapContext.putImageData(mapImageData, 0, 0);
            }

            // console.log('done');
        })
        .catch((error) => console.error(error));
}, fetchInterval);

//# sourceMappingURL=index.js.map