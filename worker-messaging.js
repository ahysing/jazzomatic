"use strict";
function blockUntilRecieverReady() {
    return 0;
}
function postMessageToAudioAnalysis(message) {
    window.postMessage(message);
}
function startAudioAnalysis() {
    document.write("<script type=\"text/javascript\" src=\"audio-analysis-worker.js\"><\/script>");
}
/*
function blockUntilRecieverReady() {
    var retryTimes = 0;
    while (!navigator.serviceWorker && retryTimes++ < 100) {
        console.log('waiting for serviceWorker to spawn');
    }

    while (!navigator.serviceWorker.controller && retryTimes++ < 100) {
        console.log('waiting for serviceWorker to get activated');
    }

    return retryTimes;
}

function postMessageToAudioAnalysis(message) {
    navigator.serviceWorker.controller.postMessage(message);
}

function startAudioAnalysis() {
    navigator.serviceWorker.register('/audio-analysis-worker.js', {
        scope: '/'
    }).then(function (registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);   
        blockUntilRecieverReady();
        
        var message = {'command': 'registerControllerThread'};
        postMessageToAudioAnalysis(message);
    }).catch (function (error) {
        // Something went wrong during registration. The service-worker.js file
        // might be unavailable or contain a syntax error.
        console.log('ServiceWorker registration failed: ', error.message);
    });
}
*/