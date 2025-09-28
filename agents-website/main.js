// 1. Import the Agents SDK library
import { createAgentManager, StreamType } from '@d-id/client-sdk';
import { getGptResponse, conversation } from './backend.js';

// Import widgets here
import { initHRChart, wireSensors, pushHR } from './widgets/heartRate.js';
import { initHIITChart } from './widgets/training.js';
import { initKeyframeLoop } from './widgets/animator.js';
import { initHeartBeat } from './widgets/heartbeat.js';
import { sensors, setTargetBpm} from './widgets/sensors.js';
import { workout } from './workout_data.js';
import { WorkoutPlayer } from './widgets/workoutPlayer.js';
import { initTrainingInfoChart } from './widgets/trainingInfo.js';

// 2. Paste the 'data-client-key' in the 'auth.clientKey' variable
// (The client-key can be fetched via the Agent embed in D-ID Studio or via the API - Create Client Key Endpoint )
let auth = { type: 'key', clientKey: "Z29vZ2xlLW9hdXRoMnwxMDIzMzE1NjM1MjgwMTM2MDk1ODY6UFA2eV9MREE2VTB2bjFSa2diM3VN" };

// 3. Paste the `data-agent-id' in the 'agentId' variable
let agentId = "v2_agt_5ZrprgDw";

// Variables declaration
let streamVideoElement = document.querySelector("#streamVideoElement")
let idleVideoElement = document.querySelector("#idleVideoElement")
let textArea = document.querySelector("#textArea")
let speechButton = document.querySelector("#speechButton");
let answers = document.querySelector("#answersList")
let reconnectButton = document.querySelector("#reconnectButton")
let actionButton = document.querySelector("#actionButton");
let videoWrapper = document.querySelector("#video-wrapper");
let interruptButton = document.querySelector("#interruptButton");
let renderedMessageIds = new Set();
let srcObject;
let streamType;

// Initialize widgets
initHRChart();
initHIITChart("trainingChart");
const updater = initHeartBeat("hrNow", "heartIcon")
setInterval(() => {
    updater(); // Update heartbeat animation speed
}, 5000); // every 5s
initTrainingInfoChart("trainingInfo");
initStartWorkoutButton();

function initAnimations(exercise, holdMs) {
  const dir = `./widgets/animations/${exercise}/`;
  const exists = (url) => new Promise((res) => {
    const img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = url;
  });

  (async () => {
    const frames = [];
    for (let i = 0; ; i++) {
      const url = `${dir}${i}.png`;
      if (!(await exists(url))) break;
      frames.push({ src: url, holdMs });
    }

    console.log(`Loaded ${frames.length} frames for ${exercise}: ${frames.map(f => f.src).join(", ")}`);
    if (frames.length) initKeyframeLoop('#keyframeImg', frames, { fadeMs: 0, autoplay: true });
  })();
}

// initAnimations('burpees', 500);

// Wire sensors to widgets
wireSensors(sensors);
sensors.start();

// Spin up the workout player
const player = new WorkoutPlayer(sensors, workout, { tickMs: 200, loop: false });
// player.start();

// Define the SDK callbacks functions here
const callbacks = {
    // Link the HTML Video element with the WebRTC Stream Object (Video & Audio tracks)
    onSrcObjectReady(value) {
        console.log("SrcObject Ready")
        streamVideoElement.srcObject = value
        srcObject = value
        return srcObject
    },

    // Connection States callback method
    onConnectionStateChange(state) {
        console.log("Connection State: ", state)

        if (state == "connecting") {
            // document.querySelector("#container").style.display = "flex"

            // Displaying the Agent's name in the pages' header
            // document.querySelector("#previewName").innerHTML = agentManager.agent.preview_name

            // Setting the video elements' sources and display
            idleVideoElement.src = agentManager.agent.presenter.idle_video
            idleVideoElement.play()
            videoWrapper.style.filter = "blur(5px)"
            streamVideoElement.style.opacity = 0;
            idleVideoElement.style.opacity = 1;

            videoWrapper.style.backgroundImage = `url(${agentManager.agent.presenter.thumbnail})`
        }

        else if (state == "connected") {
            // Setting the 'Tab' key to switch between the modes and 'Enter' Key to Send a message
            textArea.addEventListener('keypress', (event) => { if (event.key === "Enter") { event.preventDefault(); handleAction() } })
            document.addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); switchModes() } })
            actionButton.removeAttribute("disabled")
            speechButton.removeAttribute("disabled")
            answers.innerHTML += `<div class="rounded-xl bg-neutral-800/60 p-3 text-lg">${agentManager.agent.greetings[0]}</div>`
            if (streamType !== StreamType.Fluent) {
                videoWrapper.style.filter = "blur(0px)"
            }
        }

        else if (state == "disconnected" || state == "closed") {
            textArea.removeEventListener('keypress', (event) => { if (event.key === "Enter") { event.preventDefault(); handleAction() } })
            document.removeEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); switchModes() } })
            document.querySelector("#container").style.display = "none"
            actionButton.setAttribute("disabled", true)
            speechButton.setAttribute("disabled", true)
            document.getElementById("video-wrapper").style.filter = "blur(5px)"
        }
    },

    // Video State callback method (Legacy and Fluent architectures)
    onVideoStateChange(state) {
        console.log("Video State: ", state)
        // FLUENT - NEW ARCHITECURE (Fluent: Single Video for both Idle and Streaming)
        if (streamType == StreamType.Fluent) {
            if (state == "START") {
                videoWrapper.style.filter = "blur(0px)"
                streamVideoElement.style.opacity = 1;
                idleVideoElement.style.opacity = 0;
            }
        }
        // LEGACY - OLD ARCHITECURE (Legacy: Switching between the idle and streamed videos elements)
        else {
            if (state == "START") {
                streamVideoElement.muted = false
                streamVideoElement.srcObject = srcObject
                idleVideoElement.style.opacity = 0;
                streamVideoElement.style.opacity = 1;
            }
            else {
                streamVideoElement.muted = true
                idleVideoElement.style.opacity = 1;
                streamVideoElement.style.opacity = 0;
            }
        }
    },

    // New messages callback method
    onNewMessage(messages, type) {
        console.log(messages, type)
        let lastIndex = messages.length - 1;
        let msg = messages[lastIndex];
        if (!msg) return;

        if (msg.role == "assistant" && type == "answer") {
            if (msg.id && renderedMessageIds.has(msg.id)) return;
            if (msg.id) renderedMessageIds.add(msg.id);
            answers.innerHTML += `<div class="mr-auto rounded-2xl border border-neutral-800 bg-neutral-800/70 p-3 text-lg leading-relaxed">${msg.content}</div>`
        }

        answers.scrollTo({
            top: answers.scrollHeight + 50,
            behavior: 'smooth'
        });
    },


    // Agent's Talking/Idle states for INTERRUPT (only valid for the new Fluent architecutre)
    onAgentActivityStateChange(state) {
        const talking = state === "TALKING";
        interruptButton.hidden = !talking;
        speechButton.hidden = talking ? true : false;
        actionButton.hidden = talking ? true : false;
    },

    // Error handling
    onError(error, errorData) {
        console.log("Error:", error, "Error Data:", errorData)
    }

}

// 5. Define the Stream options object
let streamOptions = { compatibilityMode: "on", streamWarmup: true, fluent: true }

// - - - - - - - - - - - - Local functions to utilize the Agent's SDK methods: - - - - - - - - - - - - - //

async function chat_cred() {
    let val = textArea.value
    answers.innerHTML += `<div class="max-w-[80%] ml-auto rounded-2xl bg-sky-600 text-white p-3 text-lg leading-relaxed">${val}</div>`
    textArea.value = ""
    answers.scrollTo({
        top: answers.scrollHeight + 50,
        behavior: 'smooth'
    });
    let response_text = await send_to_backend(val)

    // Supports a minimum of 3 characters
    if (val !== "" && val.length > 2) {
        let speak = agentManager.speak(
            {
                type: "text",
                input: response_text,
            }
        )
    }
}

function speak_announcement(text) {
    let speak = agentManager.speak(
        {
            type: "text",
            input: text,
        }
    )
}


// agentManager.interrupt() -> Interrupts the Agent's response - Only supported for Fluent architecture + Premium+ Avatars.
function interrupt() {
    let interrupt = agentManager.interrupt({ type: "click" })
    console.log("Interrupt")
}

// agentManager.reconnect() -> Reconnect the Agent to a new WebRTC session
function reconnect() {
    let reconnect = agentManager.reconnect()
    console.log("Reconnect")
}

// - - - - - - - - - - - - Utility Functions - - - - - - - - - - - - //

// Agent ID and Client Key check
if (agentId == "" || auth.clientKey == "") {
    connectionLabel.innerHTML = `<span style='color:red; font-weight:bold'> Missing agentID and auth.clientKey variables</span>`
    console.error("Missing agentID and auth.clientKey variables")
    console.log(`Missing agentID and auth.clientKey variables:\n\nFetch the data-client-key and the data-agent-id as explained on the Agents SDK Overview Page:\nhttps://docs.d-id.com/reference/agents-sdk-overview\n\nPaste these into their respective variables at the top of the main.js file and save.`)
}

// Chat/Speak Selection Logic
function switchModes() {
    const options = document.querySelectorAll('#buttons input[name="option"]');
    const checkedIndex = Array.from(options).findIndex(opt => opt.checked);

    const nextIndex = (checkedIndex + 1) % options.length;
    options[nextIndex].checked = true;
}
function handleAction() {
    chat_cred();
}

// Event Listeners for Agent's built-in methods
actionButton.addEventListener('click', handleAction);
speechButton.addEventListener('click', () => toggleStartStop())
reconnectButton.addEventListener('click', () => reconnect())
interruptButton.addEventListener('click', () => interrupt())

// Focus on text area and disabling the buttons when the page is loaded
window.addEventListener('load', () => {
    textArea.focus()
    actionButton.setAttribute("disabled", true)
    speechButton.setAttribute("disabled", true)
})

// - - - - - - - - - - - - *** Finally *** - - - - - - - - - - - - //

// 6. Create the 'agentManager' instance with the values created in previous steps
let agentManager = await createAgentManager(agentId, { auth, callbacks, streamOptions });
console.log("Create Agent Manager: ", agentManager)

console.log("Connecting to Agent ID: ", agentId)
await agentManager.connect()

// This will ensure that the correct stream type is being used
streamType = agentManager.getStreamType()
console.log("Stream Type:", streamType)

// - - - - - - - - - - - - *** CRED CODE *** - - - - - - - - - - - - //

async function send_to_backend(user_input) {
    return getGptResponse(user_input);
}

function initStartWorkoutButton() {
    document.getElementById("startButton").addEventListener("click", startWorkout);
}

async function startWorkout() {
    console.log("Starting workout...");
    document.getElementById("startButton").disabled = true;
    player.start();
    // Just push the system prompt
    await getGptResponse("", { type: "START_WORKOUT" }, false);
    // speak_announcement("Starting workout now.");
}

sensors.addEventListener("workout:init", e => {
    // getGptResponse("", JSON.stringify({ type: "WORKOUT_INIT", details: e.detail }));
});

sensors.addEventListener("workout:round", async e => {
    // Just push the system prompt
    console.log("round start", e.detail);
    // await getGptResponse("", { type: "ROUND_START", details: e.detail }, false);
    // speak_announcement(announcement);
});

sensors.addEventListener("workout:segment", async e => {
    // Conversation so far
    console.log(conversation)
    console.log("segment", e.detail);
    let seg = e.detail;
    let announcement = await getGptResponse("", {
        type: seg.phase === "work" ? "NEXT_EXERCISE" : seg.phase === "rest" ? "REST" : seg.phase === "cooldown" ? "COOLDOWN" : "UNKNOWN",
        exercise: seg.exercise,
        duration_sec: Math.round(seg.seg_duration_ms / 1000),
        intensity: seg.intensity,
    }, true, true);
    initAnimations(seg.exercise.toLowerCase(), 500);
    if (seg.phase === "work") {
        setTargetBpm(160 + Math.random() * 20, 30000);  // Over 30s
    } else if (seg.phase === "rest" || seg.phase === "cooldown") {
        setTargetBpm(120 + Math.random() * 10, 20000);  // Over 20s
    }
    console.log("Announcement:", announcement);
    speak_announcement(announcement);
});

sensors.addEventListener("workout:done", async e => {
    console.log("workout done", e.detail);
    let announcement = await getGptResponse("", { type: "WORKOUT_COMPLETE" }, true, true);
    // console.log("Announcement:", announcement);
    speak_announcement(announcement);
    document.getElementById("startButton").disabled = false;
});
// Greet user based and explain workout routine. Ask for readiness to begin.
// If user is ready, start narrating workout with announcements for each exercise, rest periods, and encouragement.
// 


