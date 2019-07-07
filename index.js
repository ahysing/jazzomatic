"use strict";

/* Start of web Audio functions */
const global = {
    analyser: null,
    audioCtx: null,
    sampleCallback: 0,
    frequencyData: new Float32Array(512),
    domainData: new Float32Array(512)
};

function wireAudioContextAndFiltersStartSampling(element) {
    //
    // source -> lowpass filter -> analyser
    //        \__________________> speakers
    //
    global.audioCtx = new AudioContext();

    const source = global.audioCtx.createMediaElementSource(element);
    const analyser = global.audioCtx.createAnalyser();
    analyser.fftSize = 512;

    // Create filter
    var filter = global.audioCtx.createBiquadFilter();
    filter.type = "lowpass";

    source.connect(filter);
    filter.connect(analyser);

    var speakers = global.audioCtx.destination;
    source.connect(speakers);

    if (analyser.frequencyBinCount != global.frequencyData.length) {
        global.frequencyData = new Float32Array(analyser.frequencyBinCount);
    }

    global.analyser = analyser;
    startSampleLoop(global.audioCtx, global.analyser);
}

function handleSample() {
    function isNotSilent(dataArray) {
        function isZero(value, _index, _array) {
            return value === 0;
        }

        return dataArray.length > 0 && dataArray.every(isZero) === false;
    };

    var retryTimes = blockUntilRecieverReady();
    if (retryTimes < 100) {
        global.analyser.getFloatFrequencyData(global.frequencyData);
        global.analyser.getFloatTimeDomainData(global.domainData);
        if (isNotSilent(global.frequencyData) && isNotSilent(global.domainData)) {
            const currentTime = global.audioCtx.currentTime;
            var message = {'command': "sample-lowpass", 'domainData': global.domainData, 'frequencyData': global.frequencyData, 'currentTime': currentTime};
            postMessageToAudioAnalysis(message);
        }
    } else {
        console.error('Sample dropped');
    }
}

function startSampleLoop(context, analyser) {
    if (global.sampleCallback !== 0) {
        stopSampleLoop();
    }
    // https://www.studybass.com/gear/bass-tone-and-eq/bass-frequency-range/
    // The best would be to fetch every sample, but there are more samples than what a
    // a normal computer can process in javascript
    const sampleBinSize = analyser.fftSize;
    const timeoutPrecise = (1000.0 * sampleBinSize / context.sampleRate);
    const timoeut = Math.trunc(timeoutPrecise);
    global.sampleCallback = setInterval(handleSample, timoeut);
}

function stopSampleLoop() {
    clearInterval(global.sampleCallback);
}
/* End of web Audio functions */


var frameId = -1;
function bindCameraToBackgroundBuffer(stream) {
    var audio = document.getElementById('on-speaker');
    wireAudioContextAndFiltersStartSampling(audio);
    audio.play();


    const backgroundBuffer = document.getElementById('back-buffer');
    const canvasContext = backgroundBuffer.getContext('2d');
    //const canvasContext = backgroundBuffer.getContext('webgl2');
    if (canvasContext === null) {
        displayGlError();
        return;
    }
    
    const vTracks = stream.getVideoTracks();
    if (vTracks.length) {
        var width = 0;
        var height = 0;
        for (var i = 0; i < vTracks.length; i++) {
            const firstVideo = vTracks[i];
            const videoSettings = firstVideo.getSettings();
            if (videoSettings.width > width) width = videoSettings.width;
            if (videoSettings.height > height) height = videoSettings.height;
        }

        canvasContext.width = width;
        canvasContext.height = height;
        backgroundBuffer.width = width;
        backgroundBuffer.height = height;
    }
/*
    canvasContext.clearColor(1.0, 0.0, 0.0, 1.0);
    canvasContext.clear(canvasContext.COLOR_BUFFER_BIT);
    const texture = canvasContext.createTexture();
    canvasContext.bindTexture(canvasContext.TEXTURE_2D, texture);
*/
    const sourceVideo = document.getElementById("source-video");
    sourceVideo.srcObject = stream;

    const videoOnScreen = document.getElementById("on-screen");
    videoOnScreen.srcObject = backgroundBuffer.captureStream();
    //videoOnScreen.srcObject = stream;

    function draw() {
        const backgroundBuffer = document.getElementById('back-buffer');
        const canvasContext = backgroundBuffer.getContext('2d');
        canvasContext.drawImage(sourceVideo, 0, 0, width, height);

        window.requestAnimationFrame(draw);
    };

    window.requestAnimationFrame(draw);
}

function showErrorTip(message) {
    const eb = document.getElementById("error-box");
    eb.innerText += message;
    eb.classList.remove("hidden");

}
function displayGlError() {
    showErrorTip("Unable to turn on effects. Your device is not supported.");
}

function noSuchCamera(err) {
    showErrorTip("trying to access your camera. please reload the page and give the web page web cam access next time.");
}

function showCameraNotSupported(err) {
    showErrorTip("Web cams are not supported!");
}

function handleAudioMessage(event) {
    if (event.data.command === "BPM")
    {
        console.log("BPM", event.data.BPM);
        const mixer = document.getElementById("bpm-mixer");
        mixer.classList.add("in-beat");
        addTimeout(function() {
            document.getElementById("bpm-mixer").classList.remove("in-beat");
        }, 200);
    } else if (event.data.command === "beat") {
        console.log("beat", event.data.beat);

        var beatMixer = document.getElementById("beat-mixer");
        beatMixer.classList.add("in-beat");
        setTimeout(function() {
            document.getElementById("beat-mixer").classList.remove("in-beat");
        }, 100);
    }
};

function startAudioAnalysisListener() {
    self.addEventListener("message", handleAudioMessage);
}

function startAudioThread() {
    startAudioAnalysis();
    startAudioAnalysisListener();
}

function playTrack() {
    const videoOnScreen = document.getElementById("on-screen");
    videoOnScreen.removeAttribute("poster");

    const onSpeaker = document.getElementById("on-speaker");
    onSpeaker.play();

    if (global.analyser !== null && global.analyser !== undefined) {
        startSampleLoop(global.audioCtx, global.analyser);
        if (global.audioCtx !== null) {
            global.audioCtx.resume();
        }
    } else {
        document.getElementById("error-box").innerText += "Unable to find started audio context.\n";
    }
}

function stopTrack() {
    document.getElementById("on-speaker").pause();
    stopSampleLoop();
    if (global.audioCtx !== null) {
        global.audioCtx.suspend();
    }
}

function playControls() {
    document.getElementById("record-icon").classList.add("playing-hidden");
    document.getElementById("pause-icon").classList.remove("stopped-hidden");
}

function stopControls() {
    document.getElementById("record-icon").classList.remove("playing-hidden");
    document.getElementById("pause-icon").classList.add("stopped-hidden");
}

function wireButtonPanel() {
    var modeStopped = true;
    function toggleStopStart(stopStart) {
        if (modeStopped) {
            // stopped
            playControls();
            playTrack();
        } else {
            // playing
            stopControls();
            stopTrack();
        }

        modeStopped = !modeStopped;
    }

    function toggleReplay(replay) {
        const onSpeaker = document.getElementById("on-speaker");
        onSpeaker.currentTime = 0;
    }

    document.getElementById("stop-button").addEventListener('click', toggleStopStart);
    document.getElementById("replay-button").addEventListener('click', toggleReplay);
}

function wireDebugMixers() {
    var mixer = document.getElementById("bpm-mixer");
    var ctx = mixer.getContext("2d");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, mixer.width, mixer.height);

    var vocal = document.getElementById("vocal-detecter-mixer");
    var vCtx = vocal.getContext("2d");
    vCtx.fillStyle = "green";
    vCtx.fillRect(0, 0, vocal.width, vocal.height);
}

function wireMediaControls() {
    document.getElementById("on-screen").addEventListener("pause", stopTrack);
    document.getElementById("on-screen").addEventListener("play", playTrack);
}

function wireCam() {
    const deviceRequirementsCamera = { video: true };
    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(deviceRequirementsCamera)
            .then(bindCameraToBackgroundBuffer)
            .catch(noSuchCamera);
    } else {
        showCameraNotSupported();
    }
}
//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    // Send the source to the shader object
    gl.shaderSource(shader, source);
    // Compile the shader program
    gl.compileShader(shader);
    // See if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        showErrorTip('An error occurred compiling shader: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initShaderProgram(context, vertexSrc, fragmentSrc) {
    const vertexShader = loadShader(context, context.VERTEX_SHADER, vertexSrc);
    const fragmentShader = loadShader(context, context.FRAGMENT_SHADER, fragmentSrc);
    const shaderProgram = context.createProgram();
    context.attachShader(shaderProgram, vertexShader);
    context.attachShader(shaderProgram, fragmentShader);
    context.linkProgram();
    // See if it compiled successfully
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        showErrorTip('An error occurred compiling shader: ' + gl.getProgramInfoLog(shaderProgram));
        gl.deleteShader(shader);
        return null;
    }

    return shaderProgram;
}

function setupShaders(context) {
    const vertexSrc = document.getElementById('vertex-shader').innerText;
    const fragmentSrc = document.getElementById('fragment-shader').innerText;
    const shaderProgram = initShaderProgram(context, vertexSrc, fragmentSrc);
}

function main() {
    wireButtonPanel();
    wireMediaControls();
    wireCam();
    startAudioThread();
    if (window.location.href.indexOf('debug') !== -1) {
        document.getElementById('debug-mixers').classList.remove('hidden');
        wireDebugMixers();
    }
}


main();
