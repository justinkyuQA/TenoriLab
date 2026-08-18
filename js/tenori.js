(() => {

"use strict";

const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;

const audio =
    new AudioContext();

const master =
    audio.createGain();

master.gain.value = .65;

const compressor =
    audio.createDynamicsCompressor();

master.connect(compressor);
compressor.connect(audio.destination);


const scales = {

    major:
        [0,2,4,5,7,9,11],

    minor:
        [0,2,3,5,7,8,10],

    pentatonic:
        [0,3,5,7,10],

    dorian:
        [0,2,3,5,7,9,10],

    chromatic:
        [0,1,2,3,4,5,6,7,8,9,10,11]
};


const roots = {
    "C":0,
    "C#":1,
    "D":2,
    "D#":3,
    "E":4,
    "F":5,
    "F#":6,
    "G":7,
    "G#":8,
    "A":9,
    "A#":10,
    "B":11
};


const state = {

    playing: false,

    step: 0,

    bpm: 120,

    swing: 0,

    root: "C",

    scale: "minor",

    octave: 3,

    layer: 0,

    timer: null,

    layers:
        Array.from(
            {length:8},
            (_,i) => ({
                voice:
                    [
                        "pulse",
                        "pluck",
                        "sawtooth",
                        "triangle",
                        "square",
                        "metal",
                        "sine",
                        "noise"
                    ][i],

                muted: false,

                grid:
                    Array.from(
                        {length:16},
                        () =>
                            Array(16)
                            .fill(false)
                    )
            })
        )
};


const grid =
    document.getElementById("grid");

const display =
    document.getElementById("display");

const status =
    document.getElementById("status");


function ensureAudio() {

    if (audio.state === "suspended")
        audio.resume();
}


function midiToHz(midi) {

    return (
        440 *
        Math.pow(
            2,
            (midi - 69) / 12
        )
    );
}


function rowToMidi(row) {

    const scale =
        scales[state.scale];

    /*
       Bottom row is lowest.
    */

    const degree =
        15 - row;

    const scaleIndex =
        degree % scale.length;

    const octaveOffset =
        Math.floor(
            degree /
            scale.length
        );

    return (
        12 *
        (state.octave + 1 + octaveOffset)
        +
        roots[state.root]
        +
        scale[scaleIndex]
    );
}


function makeNoiseBuffer(duration=.15) {

    const length =
        Math.floor(
            audio.sampleRate *
            duration
        );

    const buffer =
        audio.createBuffer(
            1,
            length,
            audio.sampleRate
        );

    const data =
        buffer.getChannelData(0);

    for (
        let i=0;
        i<length;
        i++
    ) {

        data[i] =
            Math.random() * 2 - 1;
    }

    return buffer;
}


function triggerVoice(
    voice,
    frequency,
    velocity=.7
) {

    ensureAudio();

    const now =
        audio.currentTime;


    if (voice === "noise") {

        const source =
            audio.createBufferSource();

        const gain =
            audio.createGain();

        const filter =
            audio.createBiquadFilter();

        source.buffer =
            makeNoiseBuffer(.12);

        filter.type =
            "bandpass";

        filter.frequency.value =
            Math.min(
                9000,
                frequency * 4
            );

        gain.gain.setValueAtTime(
            velocity * .45,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            .001,
            now + .12
        );

        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        source.start(now);

        return;
    }


    if (voice === "metal") {

        [1,1.41,1.73].forEach(
            (ratio,i) => {

                const osc =
                    audio.createOscillator();

                const gain =
                    audio.createGain();

                osc.type =
                    "square";

                osc.frequency.value =
                    frequency *
                    ratio;

                gain.gain.setValueAtTime(
                    velocity *
                    (.15 / (i+1)),
                    now
                );

                gain.gain.exponentialRampToValueAtTime(
                    .001,
                    now + .18
                );

                osc.connect(gain);
                gain.connect(master);

                osc.start(now);
                osc.stop(now + .2);
            }
        );

        return;
    }


    const osc =
        audio.createOscillator();

    const gain =
        audio.createGain();

    const filter =
        audio.createBiquadFilter();


    osc.frequency.value =
        frequency;


    if (voice === "pulse") {

        osc.type =
            "square";

    } else if (
        voice === "pluck"
    ) {

        osc.type =
            "triangle";

    } else {

        osc.type =
            voice;
    }


    filter.type =
        "lowpass";

    filter.frequency.setValueAtTime(
        voice === "pluck"
            ? 5000
            : 8500,
        now
    );


    gain.gain.setValueAtTime(
        .001,
        now
    );

    gain.gain.exponentialRampToValueAtTime(
        velocity * .22,
        now + .008
    );


    const decay =
        voice === "pluck"
            ? .12
            : .32;


    gain.gain.exponentialRampToValueAtTime(
        .001,
        now + decay
    );


    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(now);
    osc.stop(
        now + decay + .03
    );
}


function previewRow(row) {

    const midi =
        rowToMidi(row);

    triggerVoice(
        state.layers[
            state.layer
        ].voice,

        midiToHz(midi),

        .9
    );
}


function buildGrid() {

    grid.innerHTML = "";

    for (
        let row=0;
        row<16;
        row++
    ) {

        for (
            let col=0;
            col<16;
            col++
        ) {

            const cell =
                document.createElement(
                    "button"
                );

            cell.className =
                "cell";

            cell.dataset.row =
                row;

            cell.dataset.col =
                col;


            cell.addEventListener(
                "pointerdown",
                event => {

                    event.preventDefault();

                    const layer =
                        state.layers[
                            state.layer
                        ];

                    layer.grid[row][col] =
                        !layer.grid[row][col];

                    previewRow(row);

                    drawGrid();

                    save();
                }
            );


            grid.appendChild(
                cell
            );
        }
    }
}


function buildRows() {

    const labels =
        document.getElementById(
            "rowLabels"
        );

    labels.innerHTML = "";

    for (
        let row=0;
        row<16;
        row++
    ) {

        const el =
            document.createElement(
                "div"
            );

        el.className =
            "row-label";

        el.textContent =
            16-row;

        labels.appendChild(el);
    }
}


function drawGrid() {

    const layer =
        state.layers[
            state.layer
        ];

    const cells =
        grid.children;

    let index = 0;

    for (
        let row=0;
        row<16;
        row++
    ) {

        for (
            let col=0;
            col<16;
            col++
        ) {

            const cell =
                cells[index++];

            cell.classList.toggle(
                "on",
                layer.grid[row][col]
            );

            cell.classList.toggle(
                "playhead",
                state.playing &&
                col === state.step
            );
        }
    }


    document
        .getElementById(
            "layerNumber"
        )
        .textContent =
            state.layer + 1;


    document
        .getElementById(
            "voice"
        )
        .value =
            layer.voice;


    document
        .getElementById(
            "mute"
        )
        .textContent =
            layer.muted
                ? "UNMUTE LAYER"
                : "MUTE LAYER";


    updateDisplay();
    drawLayers();
}


function flashCell(
    row,
    col
) {

    const index =
        row * 16 + col;

    const cell =
        grid.children[index];

    if (!cell)
        return;

    cell.classList.add(
        "hit"
    );

    setTimeout(
        () =>
            cell.classList.remove(
                "hit"
            ),
        70
    );
}


function fireStep(step) {

    state.layers.forEach(
        (layer,layerIndex) => {

            if (layer.muted)
                return;

            for (
                let row=0;
                row<16;
                row++
            ) {

                if (
                    !layer.grid[row][step]
                )
                    continue;

                const midi =
                    rowToMidi(row);

                triggerVoice(
                    layer.voice,
                    midiToHz(midi),
                    .72
                );

                if (
                    layerIndex ===
                    state.layer
                ) {

                    flashCell(
                        row,
                        step
                    );
                }
            }
        }
    );
}


function stepTime(step) {

    const base =
        (60000 / state.bpm) / 4;

    const amount =
        base *
        (state.swing / 100) *
        .55;

    return (
        step % 2
            ? base + amount
            : base - amount
    );
}


function tick() {

    if (!state.playing)
        return;

    fireStep(
        state.step
    );

    drawGrid();

    const delay =
        stepTime(
            state.step
        );

    state.step =
        (
            state.step + 1
        ) % 16;

    state.timer =
        setTimeout(
            tick,
            delay
        );
}


function play() {

    ensureAudio();

    if (state.playing) {

        stop();
        return;
    }

    state.playing = true;
    state.step = 0;

    status.textContent =
        "PLAY";

    document
        .getElementById("play")
        .textContent =
            "■ STOP";

    tick();
}


function stop() {

    state.playing = false;

    clearTimeout(
        state.timer
    );

    state.step = 0;

    status.textContent =
        "STOP";

    document
        .getElementById("play")
        .textContent =
            "▶ PLAY";

    drawGrid();
}


function changeLayer(delta) {

    state.layer =
        (
            state.layer +
            delta +
            8
        ) % 8;

    drawGrid();
}


function clearLayer() {

    state.layers[
        state.layer
    ].grid =
        Array.from(
            {length:16},
            () =>
                Array(16)
                .fill(false)
        );

    drawGrid();
    save();
}


function randomize() {

    const layer =
        state.layers[
            state.layer
        ];

    for (
        let row=0;
        row<16;
        row++
    ) {

        for (
            let col=0;
            col<16;
            col++
        ) {

            /*
               Sparse musical randomization.
            */

            layer.grid[row][col] =
                Math.random() <
                (
                    col % 4 === 0
                        ? .13
                        : .045
                );
        }
    }

    drawGrid();
    save();
}


function buildLayers() {

    const strip =
        document.getElementById(
            "layerStrip"
        );

    strip.innerHTML = "";

    for (
        let i=0;
        i<8;
        i++
    ) {

        const button =
            document.createElement(
                "button"
            );

        button.className =
            "layer-key";

        button.dataset.layer =
            i;

        button.addEventListener(
            "click",
            () => {

                state.layer = i;
                drawGrid();
            }
        );

        strip.appendChild(
            button
        );
    }

    drawLayers();
}


function drawLayers() {

    document
        .querySelectorAll(
            ".layer-key"
        )
        .forEach(
            (button,i) => {

                const layer =
                    state.layers[i];

                const hasNotes =
                    layer.grid.some(
                        row =>
                            row.some(Boolean)
                    );

                button.textContent =
                    `L${i+1}`;

                button.classList.toggle(
                    "active",
                    i === state.layer
                );

                button.classList.toggle(
                    "has-notes",
                    hasNotes
                );
            }
        );
}


function updateDisplay() {

    const layer =
        state.layers[
            state.layer
        ];

    display.textContent =
        `L${state.layer+1} · ${
            layer.voice.toUpperCase()
        } · ${state.root} ${
            state.scale.toUpperCase()
        }`;
}


function save() {

    const data = {

        bpm:
            state.bpm,

        swing:
            state.swing,

        root:
            state.root,

        scale:
            state.scale,

        octave:
            state.octave,

        layers:
            state.layers
    };

    localStorage.setItem(
        "tenoriLabProject",
        JSON.stringify(data)
    );
}


function load() {

    try {

        const raw =
            localStorage.getItem(
                "tenoriLabProject"
            );

        if (!raw)
            return;

        const data =
            JSON.parse(raw);

        if (data.bpm)
            state.bpm =
                data.bpm;

        if (
            Number.isFinite(
                data.swing
            )
        )
            state.swing =
                data.swing;

        if (data.root)
            state.root =
                data.root;

        if (data.scale)
            state.scale =
                data.scale;

        if (data.octave)
            state.octave =
                data.octave;

        if (
            Array.isArray(
                data.layers
            ) &&
            data.layers.length === 8
        )
            state.layers =
                data.layers;

    } catch(err) {

        console.warn(
            "Project load failed",
            err
        );
    }
}


/* =========================================================
   CONTROLS
   ========================================================= */

document
    .getElementById("play")
    .addEventListener(
        "click",
        play
    );


document
    .getElementById("clear")
    .addEventListener(
        "click",
        clearLayer
    );


document
    .getElementById("random")
    .addEventListener(
        "click",
        randomize
    );


document
    .getElementById("prevLayer")
    .addEventListener(
        "click",
        () =>
            changeLayer(-1)
    );


document
    .getElementById("nextLayer")
    .addEventListener(
        "click",
        () =>
            changeLayer(1)
    );


document
    .getElementById("mute")
    .addEventListener(
        "click",
        () => {

            const layer =
                state.layers[
                    state.layer
                ];

            layer.muted =
                !layer.muted;

            drawGrid();
            save();
        }
    );


document
    .getElementById("voice")
    .addEventListener(
        "change",
        event => {

            state.layers[
                state.layer
            ].voice =
                event.target.value;

            drawGrid();
            save();
        }
    );


const bpm =
    document.getElementById(
        "bpm"
    );

bpm.addEventListener(
    "input",
    () => {

        state.bpm =
            Number(
                bpm.value
            );

        document
            .getElementById(
                "bpmValue"
            )
            .textContent =
                state.bpm;

        save();
    }
);


const swing =
    document.getElementById(
        "swing"
    );

swing.addEventListener(
    "input",
    () => {

        state.swing =
            Number(
                swing.value
            );

        document
            .getElementById(
                "swingValue"
            )
            .textContent =
                state.swing;

        save();
    }
);


document
    .getElementById("root")
    .addEventListener(
        "change",
        event => {

            state.root =
                event.target.value;

            drawGrid();
            save();
        }
    );


document
    .getElementById("scale")
    .addEventListener(
        "change",
        event => {

            state.scale =
                event.target.value;

            drawGrid();
            save();
        }
    );


const octave =
    document.getElementById(
        "octave"
    );

octave.addEventListener(
    "input",
    () => {

        state.octave =
            Number(
                octave.value
            );

        document
            .getElementById(
                "octaveValue"
            )
            .textContent =
                state.octave;

        save();
    }
);


/* =========================================================
   BOOT
   ========================================================= */

load();

bpm.value =
    state.bpm;

swing.value =
    state.swing;

octave.value =
    state.octave;

document
    .getElementById(
        "bpmValue"
    )
    .textContent =
        state.bpm;

document
    .getElementById(
        "swingValue"
    )
    .textContent =
        state.swing;

document
    .getElementById(
        "octaveValue"
    )
    .textContent =
        state.octave;

document
    .getElementById(
        "root"
    )
    .value =
        state.root;

document
    .getElementById(
        "scale"
    )
    .value =
        state.scale;

buildRows();
buildGrid();
buildLayers();
drawGrid();

console.log(
    "TENORI LAB READY"
);

})();


/* ============================================================
   TENORILAB_GROUPED_GRID_V1
   Visual 4 / 8 / 16 musical counting enhancement
   ============================================================ */

function installMusicalGridGuide() {

    const grid =
        document.getElementById("grid");

    if (!grid) {
        console.warn(
            "Tenori grouped-grid guide: #grid not found."
        );
        return;
    }

    /*
     * Avoid duplicate headers if initialization is ever
     * called more than once.
     */

    if (
        document.getElementById(
            "tenoriMusicalGridGuide"
        )
    ) {
        return;
    }


    const guide =
        document.createElement("div");

    guide.id =
        "tenoriMusicalGridGuide";


    /* BAR HEADER */

    const bars =
        document.createElement("div");

    bars.className =
        "tenori-bar-header";

    for (
        let bar = 1;
        bar <= 4;
        bar++
    ) {

        const label =
            document.createElement("span");

        label.textContent =
            bar;

        bars.appendChild(label);
    }


    /* STEP HEADER */

    const counts =
        document.createElement("div");

    counts.className =
        "tenori-count-header";

    for (
        let step = 0;
        step < 16;
        step++
    ) {

        const label =
            document.createElement("span");

        label.className =
            "tenori-count-step";

        /*
         * Repeat 1 2 3 4 rather than 1–16.
         *
         * This makes quarter-note groupings readable
         * instantly when programming patterns.
         */

        label.textContent =
            (step % 4) + 1;


        if (
            step % 4 === 0
        ) {
            label.classList.add(
                "beat-start"
            );
        }


        if (
            (step + 1) % 4 === 0
        ) {
            label.classList.add(
                "group-end"
            );
        }


        if (
            step === 7
        ) {
            label.classList.add(
                "half-end"
            );
        }


        counts.appendChild(label);
    }


    guide.appendChild(bars);
    guide.appendChild(counts);

    grid.parentNode.insertBefore(
        guide,
        grid
    );
}


/*
 * Highlight the current four-step group.
 *
 * This does NOT control sequencing.
 * It only mirrors the existing playhead.
 */

function updateMusicalGridGuide() {

    const grid =
        document.getElementById("grid");

    if (!grid) {
        return;
    }


    const cells =
        Array.from(grid.children);


    cells.forEach(cell => {

        cell.classList.remove(
            "tenori-current-quarter"
        );

    });


    /*
     * Detect the existing playhead using several common
     * class names without requiring the original engine
     * to be rewritten.
     */

    const current =
        cells.findIndex(cell =>
            cell.classList.contains("playing") ||
            cell.classList.contains("playhead") ||
            cell.classList.contains("current")
        );


    if (current < 0) {
        return;
    }


    const step =
        current % 16;

    const quarter =
        Math.floor(step / 4);

    const start =
        quarter * 4;


    /*
     * Apply the quarter highlight to every row.
     */

    for (
        let row = 0;
        row < 16;
        row++
    ) {

        for (
            let offset = 0;
            offset < 4;
            offset++
        ) {

            const index =
                row * 16 +
                start +
                offset;

            if (cells[index]) {

                cells[index]
                    .classList.add(
                        "tenori-current-quarter"
                    );

            }
        }
    }
}


/*
 * Observe grid class changes made by the existing
 * Tenori sequencer. This keeps the guide synchronized
 * without touching the audio scheduler.
 */

function watchMusicalGridPlayhead() {

    const grid =
        document.getElementById("grid");

    if (!grid) {
        return;
    }


    const observer =
        new MutationObserver(() => {

            updateMusicalGridGuide();

        });


    observer.observe(
        grid,
        {
            subtree: true,
            attributes: true,
            attributeFilter: [
                "class"
            ]
        }
    );
}


/*
 * Install after the original application has built
 * its grid.
 */

window.addEventListener(
    "load",
    () => {

        installMusicalGridGuide();
        watchMusicalGridPlayhead();
        updateMusicalGridGuide();

    }
);

