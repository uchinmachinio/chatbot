var recognizing;

if (navigator.userAgent.includes("Firefox")) {
  recognition = new SpeechRecognition()
} else {
  recognition = new webkitSpeechRecognition()
}
// Set the language recognition here
recognition.lang = "en_US"

recognition.continuous = true;
reset();
recognition.onend = reset;

recognition.onresult = function (event) {
  for (var i = event.resultIndex; i < event.results.length; ++i) {
    if (event.results[i].isFinal) {
      textArea.value += event.results[i][0].transcript;
    }
  }
}

function reset() {
  recognizing = false;
  speechButton.style.backgroundColor = "";
  actionButton.removeAttribute("disabled")
  interruptButton.removeAttribute("disabled")
}

function toggleStartStop() {
  recognition.lang = recognition.lang
  if (recognizing) {
    textArea.focus()
    recognition.stop();
    reset();
  } else {
    textArea.value = ""
    recognition.start();
    recognizing = true;
    speechButton.style.backgroundColor = "rgba(0, 0, 0, 0.25)"
  }
}