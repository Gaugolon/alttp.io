'use strict';

const onmessage = ((message) => console.log(message));

const post = (data) => postMessage(data);

setInterval(post.bind(this), 1000);